/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import * as constants from '../constants'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { Context, Environment, Value } from '../types'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as rttc from '../utils/rttc'
import Closure from './closure'
import Thunk from './thunk'
import {
  createBlockEnvironment,
  createEnvironment,
  currentEnvironment,
  DECLARED_BUT_NOT_YET_ASSIGNED,
  declareFunctionsAndVariables,
  declareImports,
  defineVariable,
  handleRuntimeError,
  leave,
  popEnvironment,
  pushEnvironment,
  visit
} from './environment-management'
import { loadIIFEModule } from '../modules/moduleLoader'

class ReturnValue {
  constructor(public value: Value) {}
}

const getVariable = (context: Context, name: string) => {
  let environment: Environment | null = context.runtime.environments[0]
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (environment.head[name] === DECLARED_BUT_NOT_YET_ASSIGNED) {
        return handleRuntimeError(
          context,
          new errors.UnassignedVariable(name, context.runtime.nodes[0])
        )
      } else {
        return environment.head[name]
      }
    } else {
      environment = environment.tail
    }
  }
  return handleRuntimeError(context, new errors.UndefinedVariable(name, context.runtime.nodes[0]))
}

const checkNumberOfArguments = (
  context: Context,
  callee: Closure,
  args: Value[],
  exp: es.CallExpression
) => {
  if (callee.node.params.length !== args.length) {
    return handleRuntimeError(
      context,
      new errors.InvalidNumberOfArguments(exp, callee.node.params.length, args.length)
    )
  }
  return undefined
}

function* getArgs(context: Context, call: es.CallExpression) {
  return call.arguments.map(arg => evaluate(arg, context))
}

export type Evaluator<T extends es.Node> = (node: T, context: Context) => IterableIterator<Value>

function* evaluateBlockStatement(context: Context, node: es.BlockStatement) {
  declareFunctionsAndVariables(context, node)
  let result
  for (const statement of node.body) {
    result = yield* evaluate(statement, context).evaluate()
    if (result instanceof ReturnValue) {
      break
    }
  }
  return result
}

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
export const evaluators: { [nodeType: string]: Evaluator<es.Node> } = {
  /** Simple Values */
  Literal: function*(node: es.Literal, context: Context) {
    return node.value
  },

  ThisExpression: function*(node: es.ThisExpression, context: Context) {
    return currentEnvironment(context).thisContext
  },

  // TODO: Add debugger.
  // DebuggerStatement: function*(node: es.DebuggerStatement, context: Context) {
  // },

  FunctionExpression: function*(node: es.FunctionExpression, context: Context) {
    return new Closure(node, currentEnvironment(context), context)
  },

  ArrowFunctionExpression: function*(node: es.ArrowFunctionExpression, context: Context) {
    return Closure.makeFromArrowFunction(node, currentEnvironment(context), context)
  },

  Identifier: function*(node: es.Identifier, context: Context) {
    return yield* getVariable(context, node.name).evaluate()
  },

  CallExpression: function*(node: es.CallExpression, context: Context) {
    const callee = yield* evaluate(node.callee, context).evaluate()
    const args = yield* getArgs(context, node)
    let thisContext
    if (node.callee.type === 'MemberExpression') {
      thisContext = evaluate(node.callee.object, context)
    }
    return yield* apply(context, callee, args, node, thisContext)
  },

  UnaryExpression: function*(node: es.UnaryExpression, context: Context) {
    const value = yield* evaluate(node.argument, context).evaluate()

    const error = rttc.checkUnaryExpression(node, node.operator, value)
    if (error) {
      return handleRuntimeError(context, error)
    }
    return evaluateUnaryExpression(node.operator, value)
  },

  BinaryExpression: function*(node: es.BinaryExpression, context: Context) {
    const left = yield* evaluate(node.left, context).evaluate()
    const right = yield* evaluate(node.right, context).evaluate()

    const error = rttc.checkBinaryExpression(node, node.operator, left, right)
    if (error) {
      return handleRuntimeError(context, error)
    }
    return evaluateBinaryExpression(node.operator, left, right)
  },

  IfStatement: function*(node: es.IfStatement | es.ConditionalExpression, context: Context) {
    const test = yield* evaluate(node.test, context).evaluate()
    const cons = node.consequent
    const alt = node.alternate!

    const error = rttc.checkIfStatement(node, test)
    if (error) {
      return handleRuntimeError(context, error)
    }

    return yield* evaluate(test ? cons : alt, context).evaluate()
  },

  ConditionalExpression: function*(node: es.ConditionalExpression, context: Context) {
    const test = yield* evaluate(node.test, context).evaluate()
    const cons = node.consequent
    const alt = node.alternate!

    const error = rttc.checkIfStatement(node, test)
    if (error) {
      return handleRuntimeError(context, error)
    }

    return yield* evaluate(test ? cons : alt, context).evaluate()
  },

  LogicalExpression: function*(node: es.LogicalExpression, context: Context) {
    const left = evaluate(node.left, context)
    const right = evaluate(node.right, context)

    const leftValue = yield* left.evaluate()

    if (node.operator === '&&') {
      return leftValue ? yield* right.evaluate() : false
    } else {
      return leftValue ? true : yield* right.evaluate()
    }
  },

  VariableDeclaration: function*(node: es.VariableDeclaration, context: Context) {
    const declaration = node.declarations[0]
    const constant = node.kind === 'const'
    const id = declaration.id as es.Identifier
    const value = evaluate(declaration.init!, context)
    defineVariable(context, id.name, value, constant)
    return undefined
  },

  FunctionDeclaration: function*(node: es.FunctionDeclaration, context: Context) {
    const id = node.id as es.Identifier
    // tslint:disable-next-line:no-any
    const closure = new Closure(node, currentEnvironment(context), context)
    defineVariable(context, id.name, Thunk.from(closure), true)
    return undefined
  },

  ExpressionStatement: function*(node: es.ExpressionStatement, context: Context) {
    return yield* evaluate(node.expression, context).evaluate()
  },

  // TODO[@plty] support TCO later
  ReturnStatement: function*(node: es.ReturnStatement, context: Context) {
    const returnExpression = node.argument!
    return new ReturnValue(yield* evaluate(returnExpression, context).evaluate())
  },

  BlockStatement: function*(node: es.BlockStatement, context: Context) {
    let result: Value

    // Create a new environment (block scoping)
    const environment = createBlockEnvironment(context, 'blockEnvironment')
    pushEnvironment(context, environment)
    result = evaluateBlockStatement(context, node)
    popEnvironment(context)
    return result
  },

  ImportDeclaration: function*(node: es.ImportDeclaration, context: Context) {
    const moduleName = node.source.value as string
    const neededSymbols = node.specifiers.map(spec => spec.local.name)
    const module = loadIIFEModule(moduleName)
    declareImports(context, node)
    for (const name of neededSymbols) {
      defineVariable(context, name, module[name], true)
    }
    return undefined
  },

  Program: function*(node: es.BlockStatement, context: Context) {
    context.numberOfOuterEnvironments += 1
    const environment = createBlockEnvironment(context, 'programEnvironment')
    pushEnvironment(context, environment)
    return yield* evaluateBlockStatement(context, node)
  }
}

// tslint:enable:object-literal-shorthand
export function evaluate(node: es.Node, context: Context) {
  visit(context, node)
  let frozenEnvironment = {
    ...context,
    runtime: {
      ...context.runtime,
      environments: [...context.runtime.environments]
    }
  }
  if (node.type === 'Program') {
    frozenEnvironment = context
  }
  const result = new Thunk(function*() {
    return yield* evaluators[node.type](node, frozenEnvironment)
  })
  leave(context)
  return result
}

export function* apply(
  context: Context,
  fun: Closure | Value,
  args: Value[],
  node: es.CallExpression,
  thisContext?: Value
) {
  let result: Value
  let total = 0

  while (!(result instanceof ReturnValue)) {
    if (fun instanceof Closure) {
      checkNumberOfArguments(context, fun, args, node!)
      const environment = createEnvironment(fun, args, node)
      environment.thisContext = thisContext
      pushEnvironment(context, environment)
      total++
      result = yield* evaluateBlockStatement(context, fun.node.body as es.BlockStatement)
      if (!(result instanceof ReturnValue)) {
        // No Return Value, set it as undefined
        result = new ReturnValue(undefined)
      }
    } else if (typeof fun === 'function') {
      try {
        result = yield* fun.apply(thisContext, args)
        break
      } catch (e) {
        // Recover from exception
        context.runtime.environments = context.runtime.environments.slice(
          -context.numberOfOuterEnvironments
        )

        const loc = node ? node.loc! : constants.UNKNOWN_LOCATION
        if (!(e instanceof RuntimeSourceError || e instanceof errors.ExceptionError)) {
          // The error could've arisen when the builtin called a source function which errored.
          // If the cause was a source error, we don't want to include the error.
          // However if the error came from the builtin itself, we need to handle it.
          return handleRuntimeError(context, new errors.ExceptionError(e, loc))
        }
        result = undefined
        throw e
      }
    } else {
      return handleRuntimeError(context, new errors.CallingNonFunctionValue(fun, node))
    }
  }
  // Unwraps return value and release stack environment
  if (result instanceof ReturnValue) {
    result = result.value
  }
  for (let i = 1; i <= total; i++) {
    popEnvironment(context)
  }
  return result
}
