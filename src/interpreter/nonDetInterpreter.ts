/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import * as constants from '../constants'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { Context, Environment, Frame, Value } from '../types'
import { conditionalExpression, literal, primitive } from '../utils/astCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as rttc from '../utils/rttc'
import Closure from './closure'
import * as _ from 'lodash'

class ReturnValue {
  constructor(public value: Value) {}
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

const currentEnvironment = (context: Context) => context.runtime.environments[0]
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
  return yield* evalArgs(context, _.cloneDeep(call.arguments) as es.Expression[], [])
}

function* evalArgs(
  context: Context,
  args: es.Expression[],
  argsValues: Value[]
): IterableIterator<Value[]> {
  if (args.length === 0) {
    yield argsValues
  } else {
    const arg = args.shift()
    if (arg) {
      const argGen = evaluateNonDet(arg, context)
      let argNext = argGen.next()
      while (!argNext.done) {
        const argValue = argNext.value
        argsValues.push(argValue)
        yield* evalArgs(context, args, argsValues)
        argsValues.pop()
        argNext = argGen.next()
      }
      args.unshift(arg)
    }
  }
}

function* ambChoices(context: Context, call: es.CallExpression) {
  const contextSnapshot = _.cloneDeep(context)
  for (const arg of call.arguments) {
    yield* evaluateNonDet(arg, context)
    _.assignIn(context, _.cloneDeep(contextSnapshot))
  }
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
  yield* evaluateSequence(context, _.cloneDeep(node.body)) // evaluateSequence will modify node.body for recursion
}

function* evaluateSequence(context: Context, sequence: es.Statement[]): IterableIterator<Value> {
  const statement = sequence[0]
  const sequenceValGenerator = evaluateNonDet(statement, context)
  if (sequence.length === 1) {
    yield* sequenceValGenerator
  } else {
    sequence.shift()
    for (const sequenceValue of sequenceValGenerator) {
      // console.log('evaluateSequence sequenceValue = ' + sequenceValue)
      if (sequenceValue instanceof ReturnValue) {
        // console.log('sequenceValue instanceof ReturnValue')
        yield sequenceValue
        continue
      }
      yield* evaluateSequence(context, sequence)
    }
    sequence.unshift(statement) // restore the statement
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

  ArrowFunctionExpression: function*(node: es.ArrowFunctionExpression, context: Context) {
    yield Closure.makeFromArrowFunction(node, currentEnvironment(context), context)
  },

  Identifier: function*(node: es.Identifier, context: Context) {

    const res = getVariable(context, node.name)
    yield res
    return
  },

  CallExpression: function*(node: es.CallExpression, context: Context) {
    if(node.callee.type==="Identifier"){
      const funcName = node.callee.name
      if(funcName==="amb"){
        console.log('CallExpression amb called......')
        yield* ambChoices(context,node)
        return
      }
    }
    const calleeGen = evaluateNonDet(node.callee, context)
    let calleeNext = calleeGen.next()
    while (!calleeNext.done) {
      const argsGen = getArgs(context, node)
      let argsNext = argsGen.next()
      const callee = calleeNext.value
      while (!argsNext.done) {
        const args = argsNext.value
        if(node.callee.type==="Identifier"){
          console.log(`applying args ${args} to Identifier ${node.callee.name}`)
        }

        yield* apply(context, callee, args, node, undefined)
        argsNext = argsGen.next()
      }
      calleeNext = calleeGen.next()
    }
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
      console.log("VariableDeclaration called......")
      defineVariable(context, id.name, valueNext.value, constant)
      yield "VariableDeclaration done "+valueNext.value
      valueNext = valueGen.next()
    }
    return
  },

  AssignmentExpression: function*(node: es.AssignmentExpression, context: Context) {
    const id = node.left as es.Identifier
    // Make sure it exist
    const valueGen = evaluateNonDet(node.right, context)
    let valueNext = valueGen.next()
    while (!valueNext.done) {
      const valueV = valueNext.value
      setVariable(context, id.name, valueV)
      yield valueV
      valueNext = valueGen.next()
    }

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

  BlockStatement: function*(node: es.BlockStatement, context: Context) {

    // Create a new environment (block scoping)
    const environment = createBlockEnvironment(context, 'blockEnvironment')
    pushEnvironment(context, environment)
    const resultGen = evaluateBlockStatement(context, node)
    let resultNext = resultGen.next()
    while (!resultNext.done) {
      const resultValue = resultNext.value
      popEnvironment(context)
      yield resultValue
      pushEnvironment(context,environment)
      resultNext = resultGen.next()
    }
    popEnvironment(context)
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
  if (!node) {
    return undefined
  }
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

    const resultGen = evaluateBlockStatement(context, fun.node.body as es.BlockStatement)
    let resultNext = resultGen.next()
    while (!resultNext.done) {
      const result = resultNext.value
      popEnvironment(context)
      if (result instanceof ReturnValue) {
        yield result.value
      } else {
        yield undefined
      }
      pushEnvironment(context, environment)
      resultNext = resultGen.next()
    }
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
