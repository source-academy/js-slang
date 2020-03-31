/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import * as constants from '../constants'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { Context, Value } from '../types'
import { conditionalExpression, literal } from '../utils/astCreator'
import * as rttc from '../utils/rttc'
import Closure from './closure'
import * as env from './environmentUtils'
import { makeThunkAware } from './thunk'

export class BreakValue {}

export class ContinueValue {}

export class ReturnValue {
  constructor(public value: Value) {}
}

export class TailCallReturnValue {
  constructor(public callee: Closure, public args: Value[], public node: es.CallExpression) {}
}

export type Evaluator<T extends es.Node> = (node: T, context: Context) => IterableIterator<Value>

export function transformLogicalExpression(node: es.LogicalExpression): es.ConditionalExpression {
  if (node.operator === '&&') {
    return conditionalExpression(node.left, node.right, literal(false), node.loc!)
  } else {
    return conditionalExpression(node.left, literal(true), node.right, node.loc!)
  }
}

function checkNumberOfArguments(
  context: Context,
  callee: Closure,
  args: Value[],
  exp: es.CallExpression
) {
  if (callee.node.params.length !== args.length) {
    return env.handleRuntimeError(
      context,
      new errors.InvalidNumberOfArguments(exp, callee.node.params.length, args.length)
    )
  }
  return undefined
}

export function* getArgs(context: Context, call: es.CallExpression, evaluate: Evaluator<es.Node>) {
  const args = []
  for (const arg of call.arguments) {
    args.push(yield* evaluate(arg, context))
  }
  return args
}

export function* reduceIf(
  node: es.IfStatement | es.ConditionalExpression,
  context: Context,
  forceEvaluate: Evaluator<es.Node>
): IterableIterator<es.Node> {
  const test = yield* forceEvaluate(node.test, context)

  const error = rttc.checkIfStatement(node, test)
  if (error) {
    return env.handleRuntimeError(context, error)
  }

  return test ? node.consequent : node.alternate
}

export function* evaluateBlockStatement(
  context: Context,
  node: es.BlockStatement,
  forceEvaluate: Evaluator<es.Node>
) {
  env.hoistFunctionsAndVariableDeclarationsIdentifiers(context, node)
  let result
  for (const statement of node.body) {
    result = yield* forceEvaluate(statement, context)
    if (
      result instanceof ReturnValue ||
      result instanceof TailCallReturnValue ||
      result instanceof BreakValue ||
      result instanceof ContinueValue
    ) {
      break
    }
  }
  return result
}

export function* apply(
  context: Context,
  fun: Closure | Value,
  args: Value[],
  node: es.CallExpression,
  forceEvaluate: Evaluator<es.Node>,
  thisContext?: Value
) {
  let result: Value
  let total = 0

  while (!(result instanceof ReturnValue)) {
    if (fun instanceof Closure) {
      checkNumberOfArguments(context, fun, args, node!)
      const environment = env.createEnvironment(fun, args, node)
      environment.thisContext = thisContext
      if (result instanceof TailCallReturnValue) {
        env.replaceEnvironment(context, environment)
      } else {
        env.pushEnvironment(context, environment)
        total++
      }
      result = yield* evaluateBlockStatement(
        context,
        fun.node.body as es.BlockStatement,
        forceEvaluate
      )
      if (result instanceof TailCallReturnValue) {
        fun = result.callee
        node = result.node
        args = result.args
      } else if (!(result instanceof ReturnValue)) {
        // No Return Value, set it as undefined
        result = new ReturnValue(undefined)
      }
    } else if (typeof fun === 'function') {
      try {
        const thunkAwareCallee = makeThunkAware(fun, thisContext)
        result = yield* thunkAwareCallee(...args)
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
          return env.handleRuntimeError(context, new errors.ExceptionError(e, loc))
        }
        result = undefined
        throw e
      }
    } else {
      return env.handleRuntimeError(context, new errors.CallingNonFunctionValue(fun, node))
    }
  }
  // Unwraps return value and release stack environment
  if (result instanceof ReturnValue) {
    result = result.value
  }
  for (let i = 1; i <= total; i++) {
    env.popEnvironment(context)
  }
  return result
}
