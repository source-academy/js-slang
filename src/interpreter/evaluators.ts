/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import * as errors from '../errors/errors'
import { Context, Value } from '../types'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as rttc from '../utils/rttc'
import Closure, { BoundedApplyFunction } from './closure'
import * as env from './environmentUtils'
import { BreakValue, ContinueValue, ReturnValue, TailCallReturnValue } from './evaluatorUtils'
import { Evaluator, getArgs, apply } from './evaluatorUtils'
import { transformLogicalExpression, reduceIf, evaluateBlockStatement } from './evaluatorUtils'
import { makeThunkAware } from './thunk'


export function getEvaluators(
  evaluate: Evaluator<es.Node>,
  forceEvaluate: Evaluator<es.Node>
): { [nodeType: string]: Evaluator<es.Node> } {
  const boundedApplyFunction: BoundedApplyFunction = (context, fun, args, node, thisContext) =>
    apply(context, fun, args, node, forceEvaluate, thisContext)
  /**
   * WARNING: Do not use object literal shorthands, e.g.
   *   {
   *     *Literal(node: es.Literal, ...) {...},
   *     *ThisExpression(node: es.ThisExpression, ..._ {...},
   *     ...
   *   }
   * They do not minify well, raising uncaught syntax errors in production.
   * See: https://github.com/webpack/webpack/issues/7566
   */
  // tslint:disable:object-literal-shorthand
  // prettier-ignore

  return {
    Literal: function*(node: es.Literal, _context: Context) {
      return node.value
    },

    ThisExpression: function*(_node: es.ThisExpression, context: Context) {
      return context.runtime.environments[0].thisContext
    },

    ArrayExpression: function*(node: es.ArrayExpression, context: Context) {
      const res = []
      for (const n of node.elements) {
        res.push(yield* evaluate(n, context))
      }
      return res
    },

    DebuggerStatement: function*(_node: es.DebuggerStatement, context: Context) {
      context.runtime.break = true
      yield
    },

    FunctionExpression: function*(node: es.FunctionExpression, context: Context) {
      return new Closure(node, env.currentEnvironment(context), context, boundedApplyFunction)
    },

    ArrowFunctionExpression: function*(node: es.ArrowFunctionExpression, context: Context) {
      return Closure.makeFromArrowFunction(node, env.currentEnvironment(context), context, boundedApplyFunction)
    },

    Identifier: function*(node: es.Identifier, context: Context) {
      return env.getVariable(context, node.name)
    },

    CallExpression: function*(node: es.CallExpression, context: Context) {
      const callee = yield* forceEvaluate(node.callee, context)
      const args = yield* getArgs(context, node, evaluate)
      let thisContext
      if (node.callee.type === 'MemberExpression') {
        thisContext = yield* forceEvaluate(node.callee.object, context)
      }
      const result = yield* apply(context, callee, args, node, forceEvaluate, thisContext)
      return result
    },

    NewExpression: function*(node: es.NewExpression, context: Context) {
      const callee = yield* forceEvaluate(node.callee, context)
      const args = []
      for (const arg of node.arguments) {
        args.push(yield* evaluate(arg, context))
      }
      const obj: Value = {}
      if (callee instanceof Closure) {
        obj.__proto__ = callee.fun.prototype
        callee.fun.apply(obj, args)
      } else {
        obj.__proto__ = callee.prototype
        const thunkAwareCallee = makeThunkAware(callee, obj)
        yield* thunkAwareCallee(...args)
      }
      return obj
    },

    UnaryExpression: function*(node: es.UnaryExpression, context: Context) {
      const value = yield* forceEvaluate(node.argument, context)

      const error = rttc.checkUnaryExpression(node, node.operator, value)
      if (error) {
        return env.handleRuntimeError(context, error)
      }
      return evaluateUnaryExpression(node.operator, value)
    },

    BinaryExpression: function*(node: es.BinaryExpression, context: Context) {
      const left = yield* forceEvaluate(node.left, context) // TODO: how about ||, &&?
      const right = yield* forceEvaluate(node.right, context)

      const error = rttc.checkBinaryExpression(node, node.operator, left, right)
      if (error) {
        return env.handleRuntimeError(context, error)
      }
      return evaluateBinaryExpression(node.operator, left, right)
    },

    ConditionalExpression: function*(node: es.ConditionalExpression, context: Context) {
      return yield* this.IfStatement(node, context)
    },

    LogicalExpression: function*(node: es.LogicalExpression, context: Context) {
      return yield* this.ConditionalExpression(transformLogicalExpression(node), context)
    },

    VariableDeclaration: function*(node: es.VariableDeclaration, context: Context) {
      const declaration = node.declarations[0]
      const constant = node.kind === 'const'
      const id = declaration.id as es.Identifier
      const value = yield* evaluate(declaration.init!, context)
      env.defineVariable(context, id.name, value, constant)
      return undefined
    },

    ContinueStatement: function*(_node: es.ContinueStatement, _context: Context) {
      return new ContinueValue()
    },

    BreakStatement: function*(_node: es.BreakStatement, _context: Context) {
      return new BreakValue()
    },

    ForStatement: function*(node: es.ForStatement, context: Context) {
      // Create a new block scope for the loop variables
      const loopEnvironment = env.createBlockEnvironment(context, 'forLoopEnvironment')
      env.pushEnvironment(context, loopEnvironment)

      const initNode = node.init!
      const testNode = node.test!
      const updateNode = node.update!
      if (initNode.type === 'VariableDeclaration') {
        env.hoistVariableDeclarations(context, initNode)
      }
      yield* forceEvaluate(initNode, context)

      let value
      while (yield* forceEvaluate(testNode, context)) {
        // create block context and shallow copy loop environment head
        // see https://www.ecma-international.org/ecma-262/6.0/#sec-for-statement-runtime-semantics-labelledevaluation
        // and https://hacks.mozilla.org/2015/07/es6-in-depth-let-and-const/
        // We copy this as a const to avoid ES6 funkiness when mutating loop vars
        // https://github.com/source-academy/js-slang/issues/65#issuecomment-425618227
        const environment = env.createBlockEnvironment(context, 'forBlockEnvironment')
        env.pushEnvironment(context, environment)
        for (const name in loopEnvironment.head) {
          if (loopEnvironment.head.hasOwnProperty(name)) {
            env.hoistIdentifier(context, name, node)
            env.defineVariable(context, name, loopEnvironment.head[name], true)
          }
        }

        value = yield* forceEvaluate(node.body, context)

        // Remove block context
        env.popEnvironment(context)
        if (value instanceof ContinueValue) {
          value = undefined
        }
        if (value instanceof BreakValue) {
          value = undefined
          break
        }
        if (value instanceof ReturnValue || value instanceof TailCallReturnValue) {
          break
        }

        yield* forceEvaluate(updateNode, context)
      }

      env.popEnvironment(context)

      return value
    },

    MemberExpression: function*(node: es.MemberExpression, context: Context) {
      let obj = yield* forceEvaluate(node.object, context)
      if (obj instanceof Closure) {
        obj = obj.fun
      }
      let prop
      if (node.computed) {
        prop = yield* forceEvaluate(node.property, context)
      } else {
        prop = (node.property as es.Identifier).name
      }

      const error = rttc.checkMemberAccess(node, obj, prop)
      if (error) {
        return env.handleRuntimeError(context, error)
      }

      if (
        obj !== null &&
        obj !== undefined &&
        typeof obj[prop] !== 'undefined' &&
        !obj.hasOwnProperty(prop)
      ) {
        return env.handleRuntimeError(
          context,
          new errors.GetInheritedPropertyError(node, obj, prop)
        )
      }
      try {
        return obj[prop]
      } catch {
        return env.handleRuntimeError(context, new errors.GetPropertyError(node, obj, prop))
      }
    },

    AssignmentExpression: function*(node: es.AssignmentExpression, context: Context) {
      if (node.left.type === 'MemberExpression') {
        const left = node.left
        const obj = yield* forceEvaluate(left.object, context)
        let prop
        if (left.computed) {
          prop = yield* forceEvaluate(left.property, context)
        } else {
          prop = (left.property as es.Identifier).name
        }

        const error = rttc.checkMemberAccess(node, obj, prop)
        if (error) {
          return env.handleRuntimeError(context, error)
        }

        const val = yield* evaluate(node.right, context)
        try {
          obj[prop] = val
        } catch {
          return env.handleRuntimeError(context, new errors.SetPropertyError(node, obj, prop))
        }
        return val
      }
      const id = node.left as es.Identifier
      // Make sure it exist
      const value = yield* evaluate(node.right, context)
      env.setVariable(context, id.name, value)
      return value
    },

    FunctionDeclaration: function*(node: es.FunctionDeclaration, context: Context) {
      const id = node.id as es.Identifier
      // tslint:disable-next-line:no-any
      const closure = new Closure(node, env.currentEnvironment(context), context, boundedApplyFunction)
      env.defineVariable(context, id.name, closure, true)
      return undefined
    },

    IfStatement: function*(node: es.IfStatement | es.ConditionalExpression, context: Context) {
      return yield* forceEvaluate(yield* reduceIf(node, context, forceEvaluate), context)
    },

    ExpressionStatement: function*(node: es.ExpressionStatement, context: Context) {
      return yield* forceEvaluate(node.expression, context)
    },

    ReturnStatement: function*(node: es.ReturnStatement, context: Context) {
      let returnExpression = node.argument!

      // If we have a conditional expression, reduce it until we get something else
      while (
        returnExpression.type === 'LogicalExpression' ||
        returnExpression.type === 'ConditionalExpression'
      ) {
        if (returnExpression.type === 'LogicalExpression') {
          returnExpression = transformLogicalExpression(returnExpression)
        }
        returnExpression = yield* reduceIf(returnExpression, context, forceEvaluate)
      }

      // If we are now left with a CallExpression, then we use TCO
      if (returnExpression.type === 'CallExpression') {
        const callee = yield* forceEvaluate(returnExpression.callee, context)
        const args = yield* getArgs(context, returnExpression, evaluate)
        return new TailCallReturnValue(callee, args, returnExpression)
      } else {
        return new ReturnValue(yield* evaluate(returnExpression, context))
      }
    },

    WhileStatement: function*(node: es.WhileStatement, context: Context) {
      let value: any // tslint:disable-line
      while (
        // tslint:disable-next-line
        (yield* forceEvaluate(node.test, context)) &&
        !(value instanceof ReturnValue) &&
        !(value instanceof BreakValue) &&
        !(value instanceof TailCallReturnValue)
      ) {
        value = yield* forceEvaluate(node.body, context)
      }
      if (value instanceof BreakValue) {
        return undefined
      }
      return value
    },

    ObjectExpression: function*(node: es.ObjectExpression, context: Context) {
      const obj = {}
      for (const prop of node.properties) {
        let key
        if (prop.key.type === 'Identifier') {
          key = prop.key.name
        } else {
          key = yield* forceEvaluate(prop.key, context)
        }
        obj[key] = yield* evaluate(prop.value, context)
      }
      return obj
    },

    BlockStatement: function*(node: es.BlockStatement, context: Context) {
      let result: Value
      // Create a new environment (block scoping)
      const environment = env.createBlockEnvironment(context, 'blockEnvironment')
      env.pushEnvironment(context, environment)
      result = yield* evaluateBlockStatement(context, node, forceEvaluate)
      env.popEnvironment(context)
      return result
    },

    Program: function*(node: es.BlockStatement, context: Context) {
      context.numberOfOuterEnvironments += 1
      const environment = env.createBlockEnvironment(context, 'programEnvironment')
      env.pushEnvironment(context, environment)
      return yield* evaluateBlockStatement(context, node, forceEvaluate)
    }
  }
  // tslint:enable:object-literal-shorthand
}
