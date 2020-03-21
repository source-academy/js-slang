// functions used in the lazy evaluating interpreter

import * as es from 'estree'
import { currentEnvironment } from './interpreter'
import { Context, Thunk, Environment } from '../types'

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
export function createThunk(node: es.Node, environment: Environment): Thunk {
  return {
    type: 'Thunk',
    value: node,
    environment,
    isEvaluated: false,
    actualValue: undefined
  }
}