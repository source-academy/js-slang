/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import { Context, Value } from '../types'
import { evaluators } from './evaluators'
import Thunk, { dethunk, deepDethunk } from './thunk'

/**
 * This function is called before an evaluation.
 * @return Yields the new context, lets the scheduler
 * decide if the execution should be continued
 * or suspended.
 */
function* visit(context: Context, node: es.Node) {
  checkEditorBreakpoints(context, node)
  context.runtime.nodes.unshift(node)
  yield context
}

/**
 * This function is called after an evaluation.
 * @return Yields the new context, lets the scheduler
 * decide if the execution should be continued
 * or suspended.
 */
function* leave(context: Context) {
  context.runtime.break = false
  context.runtime.nodes.shift()
  yield context
}

/**
 * Evaluates `node` given `context`.
 *
 * In the lazy-evaluation mode, this function is guaranteed to return a `Value` which is not a `Thunk`.
 * Although the intermediate result might be a `Thunk`, in that case, it will be dethunked.
 *
 * @returns a non-thunk `Value`.
 */
export function* forceEvaluate(node: es.Node, context: Context): IterableIterator<Value> {
  yield* visit(context, node)
  const result = yield* evaluators[node.type](node, context)
  yield* leave(context)
  return yield* dethunk(result)
}

function isForceIt(node: es.Node) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'force_it'
  )
}

/**
 * If the lazy-evaluation mode is used, this function returns a `Thunk` containing `node` and `context`.
 * If the lazy-evaluation is not used, this function behaves the same as `forceEvaluate`.
 *
 * There is only one exception: if the node is a call expression in the form of `force_it(...)`,
 * the result will be deep-dethunked.
 *
 * @returns a `Thunk` if the lazy-evaluation mode is used, or a non-thunk `Value` otherwise.
 */
export function* evaluate(node: es.Node, context: Context): IterableIterator<Value> {
  if (context.variant !== 'lazy') {
    return yield* forceEvaluate(node, context)
  } else if (isForceIt(node)) {
    return yield* forceEvaluateAndDeepDethunk(node, context)
  } else {
    return new Thunk(node, context)
  }
}

/**
 * This function calls `forceEvaluate(node, context)` and `deepDethunk` the result.
 *
 * Although `forceEvaluate` never returns a `Thunk`, it might return a data structure
 * (e.g. pair, array) which contains a `Thunk`.
 * In some situations, these inner `Thunk`s have to be dethunked.
 *
 * @returns a `Value` which is deep dethunked.
 */
export function* forceEvaluateAndDeepDethunk(
  node: es.Node,
  context: Context
): IterableIterator<Value> {
  const result = yield* forceEvaluate(node, context)
  return yield* deepDethunk(result)
}
