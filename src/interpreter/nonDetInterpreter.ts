/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import * as constants from '../constants'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import { Context, Environment, Frame, Value } from '../types'
import { conditionalExpression, literal, primitive } from '../utils/astCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as rttc from '../utils/rttc'
import Closure from './closure'
import * as _ from 'lodash'

class BreakValue {}

class ContinueValue {}

class ReturnValue {
  constructor(public value: Value) {}
}

class TailCallReturnValue {
  constructor(public callee: Closure, public args: Value[], public node: es.CallExpression) {}
}

const createEnvironment = (
  closure: Closure,
  args: Value[],
  callExpression?: es.CallExpression
): Environment => {
  const environment: Environment = {
    name: closure.functionName, // TODO: Change this
    tail: closure.environment,
    head: {}
  }
  if (callExpression) {
    environment.callExpression = {
      ...callExpression,
      arguments: args.map(primitive)
    }
  }
  closure.node.params.forEach((param, index) => {
    const ident = param as es.Identifier
    environment.head[ident.name] = args[index]
  })
  return environment
}

const createBlockEnvironment = (
  context: Context,
  name = 'blockEnvironment',
  head: Frame = {}
): Environment => {
  return {
    name,
    tail: currentEnvironment(context),
    head,
    thisContext: context
  }
}

const handleRuntimeError = (context: Context, error: RuntimeSourceError): never => {
  context.errors.push(error)
  context.runtime.environments = context.runtime.environments.slice(
    -context.numberOfOuterEnvironments
  )
  throw error
}

const HOISTED_BUT_NOT_YET_ASSIGNED = Symbol('Used to implement hoisting')

function hoistIdentifier(context: Context, name: string, node: es.Node) {
  const environment = currentEnvironment(context)
  if (environment.head.hasOwnProperty(name)) {
    const descriptors = Object.getOwnPropertyDescriptors(environment.head)

    return handleRuntimeError(
      context,
      new errors.VariableRedeclaration(node, name, descriptors[name].writable)
    )
  }
  environment.head[name] = HOISTED_BUT_NOT_YET_ASSIGNED
  return environment
}

function hoistVariableDeclarations(context: Context, node: es.VariableDeclaration) {
  for (const declaration of node.declarations) {
    hoistIdentifier(context, (declaration.id as es.Identifier).name, node)
  }
}

function hoistFunctionsAndVariableDeclarationsIdentifiers(
  context: Context,
  node: es.BlockStatement
) {
  for (const statement of node.body) {
    switch (statement.type) {
      case 'VariableDeclaration':
        hoistVariableDeclarations(context, statement)
        break
      case 'FunctionDeclaration':
        hoistIdentifier(context, (statement.id as es.Identifier).name, statement)
        break
    }
  }
}

function defineVariable(context: Context, name: string, value: Value, constant = false) {
  const environment = context.runtime.environments[0]

  if (environment.head[name] !== HOISTED_BUT_NOT_YET_ASSIGNED) {
    return handleRuntimeError(
      context,
      new errors.VariableRedeclaration(context.runtime.nodes[0]!, name, !constant)
    )
  }

  Object.defineProperty(environment.head, name, {
    value,
    writable: !constant,
    enumerable: true
  })

  return environment
}

// function* visit(context: Context, node: es.Node) {
//   checkEditorBreakpoints(context, node)
//   context.runtime.nodes.unshift(node)
//   yield context
// }

// function* leave(context: Context) {
//   context.runtime.break = false
//   context.runtime.nodes.shift()
//   yield context
// }

const currentEnvironment = (context: Context) => context.runtime.environments[0]
const replaceEnvironment = (context: Context, environment: Environment) =>
  (context.runtime.environments[0] = environment)
const popEnvironment = (context: Context) => context.runtime.environments.shift()
const pushEnvironment = (context: Context, environment: Environment) =>
  context.runtime.environments.unshift(environment)

const getVariable = (context: Context, name: string) => {
  let environment: Environment | null = context.runtime.environments[0]
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (environment.head[name] === HOISTED_BUT_NOT_YET_ASSIGNED) {
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

const setVariable = (context: Context, name: string, value: any) => {
  let environment: Environment | null = context.runtime.environments[0]
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (environment.head[name] === HOISTED_BUT_NOT_YET_ASSIGNED) {
        break
      }
      const descriptors = Object.getOwnPropertyDescriptors(environment.head)
      if (descriptors[name].writable) {
        environment.head[name] = value
        return undefined
      }
      return handleRuntimeError(
        context,
        new errors.ConstAssignment(context.runtime.nodes[0]!, name)
      )
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
  const args = []
  for (const arg of call.arguments) {
    const argGen = evaluateNonDet(arg, context)
    let argNext = argGen.next()
    while (!argNext.done) {
      const argValue = argNext.value
      args.push(argValue)
      argNext = argGen.next()
    }
  }
  yield args
}

function transformLogicalExpression(node: es.LogicalExpression): es.ConditionalExpression {
  if (node.operator === '&&') {
    return conditionalExpression(node.left, node.right, literal(false), node.loc!)
  } else {
    return conditionalExpression(node.left, literal(true), node.right, node.loc!)
  }
}

function* reduceIf(
  node: es.IfStatement | es.ConditionalExpression,
  context: Context
): IterableIterator<es.Node> {
  const testGen = evaluateNonDet(node.test, context)
  let testNext = testGen.next()
  while (!testNext.done) {
    const test = testNext.value
    const error = rttc.checkIfStatement(node, test)
    if (error) {
      return handleRuntimeError(context, error)
    }
    yield test ? node.consequent : node.alternate!
    testNext = testGen.next()
  }
}

export type Evaluator<T extends es.Node> = (node: T, context: Context) => IterableIterator<Value>

function* evaluateBlockStatement(context: Context, node: es.BlockStatement) {
  hoistFunctionsAndVariableDeclarationsIdentifiers(context, node)
  // let result
  // for (const statement of node.body) {
  //   result = yield* evaluateNonDet(statement, context)
  //   if (
  //     result instanceof ReturnValue ||
  //     result instanceof TailCallReturnValue ||
  //     result instanceof BreakValue ||
  //     result instanceof ContinueValue
  //   ) {
  //     break
  //   }
  // }
  // return result

  // ??
  for(const statement of node.body){
    const resultGen = evaluateNonDet(statement, context)
    let resultNext = resultGen.next()
    while (!resultNext.done) {
      const resultValue = resultNext.value
      yield resultValue
      resultNext = resultGen.next()
    }
  }
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
// prettier-ignore
export const evaluators: { [nodeType: string]: Evaluator<es.Node> } = {
  /** Simple Values */
  Literal: function*(node: es.Literal, context: Context) {
    yield node.value
  },

  ThisExpression: function*(node: es.ThisExpression, context: Context) {
    return context.runtime.environments[0].thisContext
  },

  ArrayExpression: function*(node: es.ArrayExpression, context: Context) {
    const res = []
    for (const n of node.elements) {
      res.push(yield* evaluateNonDet(n, context))
    }
    return res
  },

  DebuggerStatement: function*(node: es.DebuggerStatement, context: Context) {
    context.runtime.break = true
    yield
  },

  FunctionExpression: function*(node: es.FunctionExpression, context: Context) {
    return new Closure(node, currentEnvironment(context), context)
  },

  ArrowFunctionExpression: function*(node: es.ArrowFunctionExpression, context: Context) {
    return Closure.makeFromArrowFunction(node, currentEnvironment(context), context)
  },

  Identifier: function*(node: es.Identifier, context: Context) {
    const res = getVariable(context, node.name)
    yield res
    return
  },

  CallExpression: function*(node: es.CallExpression, context: Context) {
    const calleeGen = evaluateNonDet(node.callee, context)
    let calleeNext = calleeGen.next()
    while (!calleeNext.done) {
      const argsGen = getArgs(context, node)
      let argsNext = argsGen.next()
      const thisContext = undefined
      const callee = calleeNext.value
      while (!argsNext.done) {
        const args = argsNext.value
        yield* apply(context, callee, args, node, thisContext)
        argsNext = argsGen.next()
      }
      calleeNext = calleeGen.next()
    }

    return

    // const args = yield* getArgs(context, node)
    //
    // if (node.callee.type === 'MemberExpression') {
    //   thisContext = yield* evaluateNonDet(node.callee.object, context)
    // }
    // const result =
    // return result
  },

  NewExpression: function*(node: es.NewExpression, context: Context) {
    const callee = yield* evaluateNonDet(node.callee, context)
    const args = []
    for (const arg of node.arguments) {
      args.push(yield* evaluateNonDet(arg, context))
    }
    const obj: Value = {}
    if (callee instanceof Closure) {
      obj.__proto__ = callee.fun.prototype
      callee.fun.apply(obj, args)
    } else {
      obj.__proto__ = callee.prototype
      callee.apply(obj, args)
    }
    return obj
  },

  UnaryExpression: function*(node: es.UnaryExpression, context: Context) {
    const valueGen = evaluateNonDet(node.argument, context)
    let valueNext = valueGen.next()
    while (!valueNext.done) {
      const value = valueNext.value
      const error = rttc.checkUnaryExpression(node, node.operator, value)
      if (error) {
        return handleRuntimeError(context, error)
      }
      yield evaluateUnaryExpression(node.operator, value)
      valueNext= valueGen.next()
    }
    return

  },

  BinaryExpression: function*(node: es.BinaryExpression, context: Context) {
    const leftGen = evaluateNonDet(node.left, context)
    const rightGen = evaluateNonDet(node.right, context)

    let leftNext = leftGen.next()
    while (!leftNext.done) {
      let rightNext = rightGen.next()
      while (!rightNext.done) {
        const left = leftNext.value
        const right = rightNext.value
        const error = rttc.checkBinaryExpression(node, node.operator, left, right)
        if (error) {
          return handleRuntimeError(context, error)
        }
        yield evaluateBinaryExpression(node.operator, left, right)

        rightNext = rightGen.next()
      }
      leftNext=leftGen.next()

    }
    return
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
    const valueGen = evaluateNonDet(declaration.init!, context)
    let valueNext = valueGen.next()
    while (!valueNext.done) {
      defineVariable(context, id.name, valueNext.value, constant)
      yield "done"
      valueNext = valueGen.next()
    }
    return undefined
  },

  ContinueStatement: function*(node: es.ContinueStatement, context: Context) {
    return new ContinueValue()
  },

  BreakStatement: function*(node: es.BreakStatement, context: Context) {
    return new BreakValue()
  },

  ForStatement: function*(node: es.ForStatement, context: Context) {
    // Create a new block scope for the loop variables
    const loopEnvironment = createBlockEnvironment(context, 'forLoopEnvironment')
    pushEnvironment(context, loopEnvironment)

    const initNode = node.init!
    const testNode = node.test!
    const updateNode = node.update!
    if (initNode.type === 'VariableDeclaration') {
      hoistVariableDeclarations(context, initNode)
    }
    yield* evaluateNonDet(initNode, context)

    let value
    while (yield* evaluateNonDet(testNode, context)) {
      // create block context and shallow copy loop environment head
      // see https://www.ecma-international.org/ecma-262/6.0/#sec-for-statement-runtime-semantics-labelledevaluation
      // and https://hacks.mozilla.org/2015/07/es6-in-depth-let-and-const/
      // We copy this as a const to avoid ES6 funkiness when mutating loop vars
      // https://github.com/source-academy/js-slang/issues/65#issuecomment-425618227
      const environment = createBlockEnvironment(context, 'forBlockEnvironment')
      pushEnvironment(context, environment)
      for (const name in loopEnvironment.head) {
        if (loopEnvironment.head.hasOwnProperty(name)) {
          hoistIdentifier(context, name, node)
          defineVariable(context, name, loopEnvironment.head[name], true)
        }
      }

      value = yield* evaluateNonDet(node.body, context)

      // Remove block context
      popEnvironment(context)
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

      yield* evaluateNonDet(updateNode, context)
    }

    popEnvironment(context)

    return value
  },

  MemberExpression: function*(node: es.MemberExpression, context: Context) {
    let obj = yield* evaluateNonDet(node.object, context)
    if (obj instanceof Closure) {
      obj = obj.fun
    }
    let prop
    if (node.computed) {
      prop = yield* evaluateNonDet(node.property, context)
    } else {
      prop = (node.property as es.Identifier).name
    }

    const error = rttc.checkMemberAccess(node, obj, prop)
    if (error) {
      return handleRuntimeError(context, error)
    }

    if (
      obj !== null &&
      obj !== undefined &&
      typeof obj[prop] !== 'undefined' &&
      !obj.hasOwnProperty(prop)
    ) {
      return handleRuntimeError(context, new errors.GetInheritedPropertyError(node, obj, prop))
    }
    try {
      return obj[prop]
    } catch {
      return handleRuntimeError(context, new errors.GetPropertyError(node, obj, prop))
    }
  },

  AssignmentExpression: function*(node: es.AssignmentExpression, context: Context) {
    if (node.left.type === 'MemberExpression') {
      const left = node.left
      const obj = yield* evaluateNonDet(left.object, context)
      let prop
      if (left.computed) {
        prop = yield* evaluateNonDet(left.property, context)
      } else {
        prop = (left.property as es.Identifier).name
      }

      const error = rttc.checkMemberAccess(node, obj, prop)
      if (error) {
        return handleRuntimeError(context, error)
      }

      const val = yield* evaluateNonDet(node.right, context)
      try {
        obj[prop] = val
      } catch {
        return handleRuntimeError(context, new errors.SetPropertyError(node, obj, prop))
      }
      return val
    }
    const id = node.left as es.Identifier
    // Make sure it exist
    const value = yield* evaluateNonDet(node.right, context)
    setVariable(context, id.name, value)
    return value
  },

  FunctionDeclaration: function*(node: es.FunctionDeclaration, context: Context) {
    const id = node.id as es.Identifier
    // tslint:disable-next-line:no-any
    const closure = new Closure(node, currentEnvironment(context), context)
    defineVariable(context, id.name, closure, true)
    yield undefined
  },

  IfStatement: function*(node: es.IfStatement | es.ConditionalExpression, context: Context) {
    const ifGen = reduceIf(node, context)
    let ifNext = ifGen.next()
    while(!ifNext.done){
      yield* evaluateNonDet(ifNext.value,context)
      ifNext = ifGen.next()
    }
    return
  },

  ExpressionStatement: function*(node: es.ExpressionStatement, context: Context) {
    return yield* evaluateNonDet(node.expression, context)
  },

  ReturnStatement: function*(node: es.ReturnStatement, context: Context) {
    const returnExpression = node.argument!
    // If we have a conditional expression, reduce it until we get something else
    const returnGen = evaluateNonDet(returnExpression, context)
    let returnNext = returnGen.next()
    while (!returnNext.done) {
      const returnValue = returnNext.value
      yield new ReturnValue(returnValue)
      returnNext = returnGen.next()
    }
  },

  WhileStatement: function*(node: es.WhileStatement, context: Context) {
    let value: any // tslint:disable-line
    while (
      // tslint:disable-next-line
      (yield* evaluateNonDet(node.test, context)) &&
      !(value instanceof ReturnValue) &&
      !(value instanceof BreakValue) &&
      !(value instanceof TailCallReturnValue)
    ) {
      value = yield* evaluateNonDet(node.body, context)
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
        key = yield* evaluateNonDet(prop.key, context)
      }
      obj[key] = yield* evaluateNonDet(prop.value, context)
    }
    return obj
  },

  BlockStatement: function*(node: es.BlockStatement, context: Context) {
    let result: Value

    // Create a new environment (block scoping)
    const environment = createBlockEnvironment(context, 'blockEnvironment')
    pushEnvironment(context, environment)
    result = yield* evaluateBlockStatement(context, node)
    popEnvironment(context)
    return result
  },

  Program: function*(node: es.BlockStatement, context: Context) {
    context.numberOfOuterEnvironments += 1
    const environment = createBlockEnvironment(context, 'programEnvironment')
    pushEnvironment(context, environment)
    return yield* evaluateBlockStatement(context, node)
  }
}
// tslint:enable:object-literal-shorthand

export function* evaluateNonDet(node: es.Node, context: Context) {
  // yield* visit(context, node)
  const result = yield* evaluators[node.type](node, context)
  // yield* leave(context)
  return result
}

export function* apply(
  context: Context,
  fun: Closure | Value,
  args: Value[],
  node: es.CallExpression,
  thisContext?: Value
) {



    if (fun instanceof Closure) {
      checkNumberOfArguments(context, fun, args, node!)
      const environment = createEnvironment(fun, args, node)
      environment.thisContext = thisContext
      pushEnvironment(context, environment)

      const resultGen =  evaluateBlockStatement(context, _.cloneDeep(fun.node.body) as es.BlockStatement)
      let resultNext = resultGen.next()
      while(!resultNext.done){
        const result = resultNext.value
        popEnvironment(context)
        if(result instanceof ReturnValue){
          yield result.value
        }else{
          yield undefined
        }
        pushEnvironment(context,environment)
        resultNext=resultGen.next()

      }
      // if (result instanceof TailCallReturnValue) {
      //   fun = result.callee
      //   node = result.node
      //   args = result.args
      // } else if (!(result instanceof ReturnValue)) {
      //   // No Return Value, set it as undefined
      //   result = new ReturnValue(undefined)
      // }
    } else if (typeof fun === 'function') {
      try {
        yield fun.apply(thisContext, args)
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
        throw e
      }
    } else {
      return handleRuntimeError(context, new errors.CallingNonFunctionValue(fun, node))
    }


    popEnvironment(context)
    return
}
