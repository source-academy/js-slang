// functions used in the lazy evaluating interpreter

import * as es from 'estree'
import {
  currentEnvironment,
  pushEnvironment,
  evaluate,
  ReturnValue,
  popEnvironment
} from './interpreter'
import { Context, InterpreterThunk, Environment, Value } from '../types'

export const thunkStringType = 'Thunk'

/**
 * Gets the thunked arguments from a lazy evaluated
 * Source function
 * @param call The CallExpression that led to evaluationy
 */
export function getThunkedArgs(context: Context, call: es.CallExpression) {
  const args = []
  const env = currentEnvironment(context)
  for (const arg of call.arguments) {
    args.push(createThunk(arg, env))
  }
  return args
}

/**
 * Creates a thunked expression using the given statement
 * as a Node. The Node will not be run until required
 * @param node The Node to be thunked
 * @param environment The environment to run the statement in
 */
export function createThunk(node: es.Node, environment: Environment): InterpreterThunk {
  return {
    type: thunkStringType,
    value: node,
    environment,
    isEvaluated: false,
    actualValue: undefined
  }
}

/**
 * Checks whether the value is a thunked expression in the interpreter
 * @param v The value to be checked
 * @returns True, if the value is a thunk.
 */
export function isThunk(v: any): boolean {
  return (
    typeof v === 'object' &&
    Object.keys(v).length === 5 &&
    v.type !== undefined &&
    v.type === thunkStringType &&
    v.isEvaluated !== undefined &&
    typeof v.isEvaluated === 'boolean' &&
    v.value !== undefined &&
    typeof v.value === 'object' &&
    v.environment !== undefined &&
    typeof v.environment === 'object'
  )
}

// Evaluates thunk and memoize
export function* evaluateThunk(thunk: InterpreterThunk, context: Context) {
  if (thunk.isEvaluated) {
    // Program should never enter this 'if' block.
    // Memoized thunks should return the actual value by evaluating an Identifier node type.
    return thunk.actualValue
  } else {
    // Keep count of the environments stacked on top of each other.
    let total = 0

    // Use the thunk's environment (on creation) to evaluate it.
    const thunkEnv: Environment = thunk.environment as Environment

    pushEnvironment(context, thunkEnv)
    total++

    let result: Value = yield* evaluate(thunk.value, context)

    // Evaluation of a thunk may return another thunk.
    // Keep evaluating until the final value is obtained.
    let tempEnv: Environment
    while (result.type === 'Thunk') {
      // Use the thunk's environment (on creation) to evaluate it.
      tempEnv = result.environment as Environment
      pushEnvironment(context, tempEnv)
      total++

      result = yield* evaluate(result.value, context)
    }

    if (result instanceof ReturnValue) {
      result = result.value
    }
    for (let i = 0; i < total; i++) {
      popEnvironment(context)
    }

    // tag this thunk as 'evaluated' and memoize its value
    thunk.isEvaluated = true
    thunk.actualValue = result
    return result
  }
}
