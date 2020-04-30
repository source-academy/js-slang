/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import { Context, Value } from '../types'
import { getEvaluators } from './evaluators'
import Thunk, { dethunk, deepDethunk } from './thunk'

function* visit(context: Context, node: es.Node) {
  checkEditorBreakpoints(context, node)
  context.runtime.nodes.unshift(node)
  yield context
}

function* leave(context: Context) {
  context.runtime.break = false
  context.runtime.nodes.shift()
  yield context
}

const evaluators = getEvaluators(evaluate, forceEvaluate)

export function* forceEvaluate(node: es.Node, context: Context): IterableIterator<Value> {
  yield* visit(context, node)
  const result = yield* evaluators[node.type](node, context)
  yield* leave(context)
  return yield* dethunk(result)
}

export function* evaluate(node: es.Node, context: Context): IterableIterator<Value> {
  if (context.variant === 'lazy') {
    return new Thunk(node, context, forceEvaluate)
  } else {
    return yield* forceEvaluate(node, context)
  }
}

export function* forceEvaluateAndDeepDethunk(
  node: es.Node,
  context: Context
): IterableIterator<Value> {
  const result = yield* forceEvaluate(node, context)
  return yield* deepDethunk(result)
}
