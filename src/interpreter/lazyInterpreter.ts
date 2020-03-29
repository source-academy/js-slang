// Functions used in the lazy evaluating interpreter

import * as es from 'estree'
import {
  currentEnvironment,
  pushEnvironment,
  evaluate,
  ReturnValue,
  popEnvironment
} from './interpreter'
import { Context, InterpreterThunk, Environment, Value } from '../types'
import Closure from './closure'

export const thunkStringType = 'Thunk'

const mathLib = Object.getOwnPropertyNames(Math).map(prop => 'math_' + prop)

// List of built-in functions that will not be evaluated lazily under Lazy Source.
export const eagerFunctions = [
  ...mathLib,
  'runtime',
  'display',
  'raw_display',
  'stringify',
  'error',
  'prompt',
  'alert',
  'has_own_property',
  'timed',
  'is_object',
  'is_NaN',
  'draw_data',
  // force functions have to be eagerly evaluated!
  'force',
  'force_once',
  'force_pair'
]

/**
 * Gets the thunked arguments from a lazy evaluated
 * Source function.
 * @param call The CallExpression that led to evaluation.
 */
export function* getThunkedArgs(context: Context, call: es.CallExpression) {
  const args = []
  const env = currentEnvironment(context)
  for (const arg of call.arguments) {
    if (arg.type === 'ArrowFunctionExpression') {
      // avoid thunking arrow expressions passed as function arguments
      args.push(Closure.makeFromArrowFunction(arg, env, context))
    } else if (arg.type === 'Literal') {
      // avoid thunking literals, just get the thunk the name points to
      const result = yield* evaluate(arg, context)
      args.push(result)
    } else {
      args.push(createThunk(arg, env, context))
    }
  }
  return args
}

/**
 * A function that eagerly evaluates every arguments.
 * Used for functions with names included in eagerFunctions array.
 * @param call The CallExpression that led to evaluation.
 */
export function* getEagerArgs(context: Context, call: es.CallExpression): Value {
  const args = []
  for (const arg of call.arguments) {
    // Unwrap the arg to expose the actual argument.
    // This may return a Thunk.
    let result = yield* evaluate(arg, context)

    // If result is Thunk, evaluate until it reaches a value.
    while (result !== null && isInterpreterThunk(result)) {
      result = yield* evaluateThunk(result, context)
    }
    args.push(result)
  }
  return args
}

/**
 * Creates a thunked expression using the given statement
 * as a Node. The Node will not be run until required.
 * @param node The Node to be thunked.
 * @param environment The environment to run the statement in.
 */
export function createThunk(
  node: es.Node,
  environment: Environment,
  context: Context
): InterpreterThunk {
  return {
    type: thunkStringType,
    value: node,
    environment,
    isEvaluated: false,
    actualValue: undefined,
    context
  }
}

/**
 * Checks whether the value is a thunked expression in the interpreter.
 * @param v The value to be checked.
 * @returns True, if the value is a thunk.
 */
export function isInterpreterThunk(v: any): boolean {
  return (
    v !== null &&
    typeof v === 'object' &&
    Object.keys(v).length === 6 &&
    v.type !== undefined &&
    v.type === thunkStringType &&
    v.isEvaluated !== undefined &&
    typeof v.isEvaluated === 'boolean' &&
    v.value !== undefined &&
    typeof v.value === 'object' &&
    v.environment !== undefined &&
    typeof v.environment === 'object' &&
    typeof v.context === 'object'
  )
}

/**
 * Evaluates thunks recursively until a value is obtained and memoize.
 * @param thunk The thunk to be evaluated.
 * @returns The value after evaluation.
 */
export function* evaluateThunk(thunk: InterpreterThunk, context: Context): Value {
  if (!isInterpreterThunk(thunk)) {
    return thunk
  } else if (thunk.isEvaluated) {
    return thunk.actualValue
  } else {
    // Use the thunk's environment (on creation) to evaluate it.
    const thunkEnv: Environment = thunk.environment as Environment
    pushEnvironment(context, thunkEnv)

    let result: Value = yield* evaluate(thunk.value, context)

    // Evaluating a thunk may return another thunk.
    // Recursively evaluate thunks until a value is obtained.
    // `result` may be null so it will be checked to avoid errors.
    if (result !== null && isInterpreterThunk(result)) {
      result = yield* evaluateThunk(result, context)
    }

    if (result instanceof ReturnValue) {
      result = result.value
    }

    popEnvironment(context)

    // Mark this thunk as 'evaluated' and memoize its value.
    thunk.isEvaluated = true
    thunk.actualValue = result
    return result
  }
}

/**
 * Evaluates a thunk once without memoizing.
 * @param thunk The thunk to be evaluated.
 * @returns The value after evaluation.
 */
export function* evaluateThunkOnce(thunk: InterpreterThunk, context: Context): Value {
  if (thunk.isEvaluated) {
    return thunk.actualValue
  } else {
    // Use the thunk's environment (on creation) to evaluate it.
    const thunkEnv: Environment = thunk.environment as Environment
    pushEnvironment(context, thunkEnv)

    let result: Value = yield* evaluate(thunk.value, context)

    if (result instanceof ReturnValue) {
      result = result.value
    }
    popEnvironment(context)
    return result
  }
}
