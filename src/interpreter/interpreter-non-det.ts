/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import { cloneDeep, uniqueId } from 'lodash'

import { CUT, UNKNOWN_LOCATION } from '../constants'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { Context, Environment, Frame, Value } from '../types'
import { conditionalExpression, literal, primitive } from '../utils/astCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as rttc from '../utils/rttc'
import Closure from './closure'

class BreakValue {}

class ContinueValue {}

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
    head: {},
    id: uniqueId()
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
    thisContext: context,
    id: uniqueId()
  }
}

const handleRuntimeError = (context: Context, error: RuntimeSourceError): never => {
  context.errors.push(error)
  context.runtime.environments = context.runtime.environments.slice(
    -context.numberOfOuterEnvironments
  )
  throw error
}

const DECLARED_BUT_NOT_YET_ASSIGNED = Symbol('Used to implement declaration')

function declareIdentifier(context: Context, name: string, node: es.Node) {
  const environment = currentEnvironment(context)
  if (environment.head.hasOwnProperty(name)) {
    const descriptors = Object.getOwnPropertyDescriptors(environment.head)

    return handleRuntimeError(
      context,
      new errors.VariableRedeclaration(node, name, descriptors[name].writable)
    )
  }
  environment.head[name] = DECLARED_BUT_NOT_YET_ASSIGNED
  return environment
}

function declareVariables(context: Context, node: es.VariableDeclaration) {
  for (const declaration of node.declarations) {
    declareIdentifier(context, (declaration.id as es.Identifier).name, node)
  }
}

function declareFunctionAndVariableIdentifiers(context: Context, node: es.BlockStatement) {
  for (const statement of node.body) {
    switch (statement.type) {
      case 'VariableDeclaration':
        declareVariables(context, statement)
        break
      case 'FunctionDeclaration':
        if (statement.id === null) {
          throw new Error(
            'Encountered a FunctionDeclaration node without an identifier. This should have been caught when parsing.'
          )
        }
        declareIdentifier(context, statement.id.name, statement)
        break
    }
  }
}

function defineVariable(context: Context, name: string, value: Value, constant = false) {
  const environment = context.runtime.environments[0]

  if (environment.head[name] !== DECLARED_BUT_NOT_YET_ASSIGNED) {
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

function undefineVariable(context: Context, name: string) {
  const environment = context.runtime.environments[0]

  Object.defineProperty(environment.head, name, {
    value: DECLARED_BUT_NOT_YET_ASSIGNED,
    writable: true,
    enumerable: true
  })
}

const currentEnvironment = (context: Context) => context.runtime.environments[0]
const popEnvironment = (context: Context) => context.runtime.environments.shift()
const pushEnvironment = (context: Context, environment: Environment) =>
  context.runtime.environments.unshift(environment)

const getVariable = (context: Context, name: string, ensureVariableAssigned: boolean) => {
  let environment: Environment | null = context.runtime.environments[0]
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (environment.head[name] === DECLARED_BUT_NOT_YET_ASSIGNED) {
        if (ensureVariableAssigned) {
          return handleRuntimeError(
            context,
            new errors.UnassignedVariable(name, context.runtime.nodes[0])
          )
        } else {
          return DECLARED_BUT_NOT_YET_ASSIGNED
        }
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
      if (environment.head[name] === DECLARED_BUT_NOT_YET_ASSIGNED) {
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

/**
 * Returns a random integer for a given interval (inclusive).
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

function* getAmbRArgs(context: Context, call: es.CallExpression) {
  const args: es.Node[] = cloneDeep(call.arguments)
  while (args.length > 0) {
    const r = randomInt(0, args.length - 1)
    const arg: es.Node = args.splice(r, 1)[0]

    yield* evaluate(arg, context)
  }
}

function* getArgs(context: Context, call: es.CallExpression) {
  const args = cloneDeep(call.arguments)
  return yield* cartesianProduct(context, args as es.Expression[], [])
}

/* Given a list of non deterministic nodes, this generator returns every
 * combination of values of these nodes */
function* cartesianProduct(
  context: Context,
  nodes: es.Expression[],
  nodeValues: Value[]
): IterableIterator<Value[]> {
  if (nodes.length === 0) {
    yield nodeValues
  } else {
    const currentNode = nodes.shift()! // we need the postfix ! to tell compiler that nodes array is nonempty
    const nodeValueGenerator = evaluate(currentNode, context)
    for (const nodeValue of nodeValueGenerator) {
      nodeValues.push(nodeValue)
      yield* cartesianProduct(context, nodes, nodeValues)
      nodeValues.pop()
    }
    nodes.unshift(currentNode)
  }
}

function* getAmbArgs(context: Context, call: es.CallExpression) {
  for (const arg of call.arguments) {
    yield* evaluate(arg, context)
  }
}

function transformLogicalExpression(node: es.LogicalExpression): es.ConditionalExpression {
  if (node.operator === '&&') {
    return conditionalExpression(node.left, node.right, literal(false), node.loc)
  } else {
    return conditionalExpression(node.left, literal(true), node.right, node.loc)
  }
}

function* reduceIf(
  node: es.IfStatement | es.ConditionalExpression,
  context: Context
): IterableIterator<es.Node> {
  const testGenerator = evaluate(node.test, context)
  for (const test of testGenerator) {
    const error = rttc.checkIfStatement(node, test, context.chapter)
    if (error) {
      return handleRuntimeError(context, error)
    }
    yield test ? node.consequent : node.alternate!
  }
}

export type Evaluator<T extends es.Node> = (node: T, context: Context) => IterableIterator<Value>

function* evaluateBlockSatement(context: Context, node: es.BlockStatement) {
  declareFunctionAndVariableIdentifiers(context, node)
  yield* evaluateSequence(context, node.body)
}

function* evaluateSequence(context: Context, sequence: es.Statement[]): IterableIterator<Value> {
  if (sequence.length === 0) {
    return yield undefined
  }
  const firstStatement = sequence[0]
  const sequenceValGenerator = evaluate(firstStatement, context)
  if (sequence.length === 1) {
    yield* sequenceValGenerator
  } else {
    sequence.shift()
    let shouldUnshift = true
    for (const sequenceValue of sequenceValGenerator) {
      // prevent unshifting of cut operator
      shouldUnshift = sequenceValue !== CUT

      if (
        sequenceValue instanceof ReturnValue ||
        sequenceValue instanceof BreakValue ||
        sequenceValue instanceof ContinueValue
      ) {
        yield sequenceValue
        continue
      }

      const res = yield* evaluateSequence(context, sequence)
      if (res === CUT) {
        // prevent unshifting of statements before cut
        shouldUnshift = false
        break
      }
    }

    if (shouldUnshift) sequence.unshift(firstStatement)
    else return CUT
  }
}

function* evaluateConditional(node: es.IfStatement | es.ConditionalExpression, context: Context) {
  const branchGenerator = reduceIf(node, context)
  for (const branch of branchGenerator) {
    yield* evaluate(branch, context)
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
  Literal: function*(node: es.Literal, _context: Context) {
    yield node.value
  },

  ArrowFunctionExpression: function*(node: es.ArrowFunctionExpression, context: Context) {
    yield Closure.makeFromArrowFunction(node, currentEnvironment(context), context)
  },

  ArrayExpression: function*(node: es.ArrayExpression, context: Context) {
    const arrayGenerator = cartesianProduct(context, node.elements as es.Expression[], [])
    for (const array of arrayGenerator) {
      yield array.slice() // yield a new array to avoid modifying previous ones
    }
  },

  Identifier: function*(node: es.Identifier, context: Context) {
    return yield getVariable(context, node.name, true)
  },

  CallExpression: function*(node: es.CallExpression, context: Context) {
    const callee = node.callee;
    if (rttc.isIdentifier(callee)) {
      switch (callee.name) {
        case 'amb':
          return yield* getAmbArgs(context, node)
        case 'ambR':
          return yield* getAmbRArgs(context, node)
        case 'cut':
          return yield CUT
      }
    }

    const calleeGenerator = evaluate(node.callee, context)
    for (const calleeValue of calleeGenerator) {
      const argsGenerator = getArgs(context, node)
      for (const args of argsGenerator) {
        yield* apply(context, calleeValue, args, node, undefined)
      }
    }
  },

  UnaryExpression: function*(node: es.UnaryExpression, context: Context) {
    const argGenerator = evaluate(node.argument, context)
    for (const argValue of argGenerator) {
      const error = rttc.checkUnaryExpression(node, node.operator, argValue, context.chapter)
      if (error) {
        return handleRuntimeError(context, error)
      }
      yield evaluateUnaryExpression(node.operator, argValue)
    }
    return
  },

  BinaryExpression: function*(node: es.BinaryExpression, context: Context) {
    const pairGenerator = cartesianProduct(context, [node.left, node.right], [])
    for (const pair of pairGenerator) {
      const leftValue = pair[0]
      const rightValue = pair[1]
      const error = rttc.checkBinaryExpression(node, node.operator, context.chapter, leftValue, rightValue)
      if (error) {
        return handleRuntimeError(context, error)
      }
      yield evaluateBinaryExpression(node.operator, leftValue, rightValue)
    }
    return
  },

  ConditionalExpression: function*(node: es.ConditionalExpression, context: Context) {
    yield* evaluateConditional(node, context)
  },

  LogicalExpression: function*(node: es.LogicalExpression, context: Context) {
    const conditional: es.ConditionalExpression = transformLogicalExpression(node)
    yield* evaluateConditional(conditional, context)
  },

  VariableDeclaration: function*(node: es.VariableDeclaration, context: Context) {
    const declaration = node.declarations[0]
    const constant = node.kind === 'const'
    const id = declaration.id as es.Identifier
    const valueGenerator = evaluate(declaration.init!, context)
    for (const value of valueGenerator) {
      defineVariable(context, id.name, value, constant)
      yield value
      undefineVariable(context, id.name)
    }
    return undefined
  },

  MemberExpression: function*(node: es.MemberExpression, context: Context) {
    // es.PrivateIdentifier is a ES2022 feature
    const pairGenerator = cartesianProduct(context, [node.property as es.Expression, node.object as es.Expression], [])
    for (const pair of pairGenerator) {
      const prop = pair[0]
      const obj = pair[1]

      const error = rttc.checkMemberAccess(node, obj, prop)
      if (error) {
        return yield handleRuntimeError(context, error)
      }

      yield obj[prop]
    }

    return
  },

  AssignmentExpression: function*(node: es.AssignmentExpression, context: Context) {
    if (node.left.type === 'MemberExpression') {
      // es.PrivateIdentifier is a ES2022 feature
      const tripleGenerator = cartesianProduct(context, [node.right, node.left.property as es.Expression, node.left.object as es.Expression], [])
      for (const triple of tripleGenerator) {
        const val = triple[0]
        const prop = triple[1]
        const obj = triple[2]

        const error = rttc.checkMemberAccess(node, obj, prop)
        if (error) {
          return yield handleRuntimeError(context, error)
        }
        const originalElementValue = obj[prop]
        obj[prop] = val
        yield val
        obj[prop] = originalElementValue
      }

      return
    }

    const id = node.left as es.Identifier
    const originalValue = getVariable(context, id.name, false)
    const valueGenerator = evaluate(node.right, context)
    for (const value of valueGenerator) {
      setVariable(context, id.name, value)
      yield value
      setVariable(context, id.name, originalValue)
    }
    return
  },

  FunctionDeclaration: function*(node: es.FunctionDeclaration, context: Context) {
    const id = node.id
    if (id === null) {
      throw new Error("Encountered a FunctionDeclaration node without an identifier. This should have been caught when parsing.")
    }
    const closure = new Closure(node, currentEnvironment(context), context)
    defineVariable(context, id.name, closure, true)
    yield undefined
    undefineVariable(context, id.name)
  },

  IfStatement: function*(node: es.IfStatement, context: Context) {
    yield* evaluateConditional(node, context)
  },

  ExpressionStatement: function*(node: es.ExpressionStatement, context: Context) {
    return yield* evaluate(node.expression, context)
  },

  ContinueStatement: function*(_node: es.ContinueStatement, _context: Context) {
    yield new ContinueValue()
  },

  BreakStatement: function*(_node: es.BreakStatement, _context: Context) {
    yield new BreakValue()
  },

  WhileStatement: function*(node: es.WhileStatement, context: Context) {
    let value: Value // tslint:disable-line
    function* loop(): Value {
      const testGenerator = evaluate(node.test, context)
      for (const test of testGenerator) {
        const error = rttc.checkIfStatement(node.test, test, context.chapter)
        if (error) return handleRuntimeError(context, error)

        if (test &&
          !(value instanceof ReturnValue) &&
          !(value instanceof BreakValue)
        ) {
          const iterationValueGenerator = evaluate(cloneDeep(node.body), context)
          for (const iterationValue of iterationValueGenerator) {
            value = iterationValue
            yield* loop();
          }
        } else {
          if (value instanceof BreakValue || value instanceof ContinueValue) {
            yield undefined
          } else {
            yield value
          }
        }
      }
    }

    yield* loop();
  },

  ForStatement: function*(node: es.ForStatement, context: Context) {
    let value: Value
    function* loop(): Value {
      const testGenerator = evaluate(node.test!, context)
      for (const test of testGenerator) {
        const error = rttc.checkIfStatement(node.test!, test, context.chapter)
        if (error) return handleRuntimeError(context, error)

        if (test &&
          !(value instanceof ReturnValue) &&
          !(value instanceof BreakValue)
        ) {
          const iterationEnvironment = createBlockEnvironment(context, 'forBlockEnvironment')
          pushEnvironment(context, iterationEnvironment)
          for (const name in loopEnvironment.head) {
            if (loopEnvironment.head.hasOwnProperty(name)) {
              declareIdentifier(context, name, node)
              defineVariable(context, name, loopEnvironment.head[name], true)
            }
          }

          const iterationValueGenerator = evaluate(cloneDeep(node.body), context)
          for (const iterationValue of iterationValueGenerator) {
            value = iterationValue
            popEnvironment(context)
            const updateNode = evaluate(node.update!, context)
            for (const _update of updateNode) {
              yield* loop();
            }

            pushEnvironment(context, iterationEnvironment)
          }
          popEnvironment(context)
        } else {
          if (value instanceof BreakValue || value instanceof ContinueValue) {
            yield undefined
          } else {
            yield value
          }
        }
      }
    }

    // Create a new block scope for the loop variables
    const loopEnvironment = createBlockEnvironment(context, 'forLoopEnvironment')
    pushEnvironment(context, loopEnvironment)

    const initNode = node.init!
    if (initNode.type === 'VariableDeclaration') {
      declareVariables(context, initNode)
    }

    const initNodeGenerator = evaluate(node.init!, context)
    for (const _init of initNodeGenerator) {
      const loopGenerator = loop()
      for (const loopValue of loopGenerator) {
        popEnvironment(context)
        yield loopValue
        pushEnvironment(context, loopEnvironment)
      }
    }

    popEnvironment(context)
  },

  ReturnStatement: function*(node: es.ReturnStatement, context: Context) {
    const returnExpression = node.argument!
    const returnValueGenerator = evaluate(returnExpression, context)
    for (const returnValue of returnValueGenerator) {
      yield new ReturnValue(returnValue)
    }
  },

  BlockStatement: function*(node: es.BlockStatement, context: Context) {
    // Create a new environment (block scoping)
    const environment = createBlockEnvironment(context, 'blockEnvironment')
    pushEnvironment(context, environment)

    const resultGenerator = evaluateBlockSatement(context, node)
    for (const result of resultGenerator) {
      popEnvironment(context)
      yield result
      pushEnvironment(context, environment)
    }
    popEnvironment(context)
  },

  Program: function*(node: es.BlockStatement, context: Context) {
    context.numberOfOuterEnvironments += 1
    const environment = createBlockEnvironment(context, 'programEnvironment')
    pushEnvironment(context, environment)
    return yield* evaluateBlockSatement(context, node)
  }
}
// tslint:enable:object-literal-shorthand

export function* evaluate(node: es.Node, context: Context) {
  const result = yield* evaluators[node.type](node, context)
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
    const applicationValueGenerator = evaluateBlockSatement(
      context,
      cloneDeep(fun.node.body) as es.BlockStatement
    )

    // This function takes a value that may be a ReturnValue.
    // If so, it returns the value wrapped in the ReturnValue.
    // If not, it returns the default value.
    function unwrapReturnValue(result: any, defaultValue: any) {
      if (result instanceof ReturnValue) {
        return result.value
      } else {
        return defaultValue
      }
    }

    for (const applicationValue of applicationValueGenerator) {
      popEnvironment(context)
      yield unwrapReturnValue(applicationValue, undefined)
      pushEnvironment(context, environment)
    }

    popEnvironment(context)
  } else if (typeof fun === 'function') {
    try {
      yield fun.apply(thisContext, args)
    } catch (e) {
      // Recover from exception
      context.runtime.environments = context.runtime.environments.slice(
        -context.numberOfOuterEnvironments
      )

      const loc = node.loc ?? UNKNOWN_LOCATION
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

  return
}

export { evaluate as nonDetEvaluate }
