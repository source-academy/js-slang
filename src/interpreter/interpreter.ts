/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import { Context, Value } from '../types'
import Closure from './closure'

import { evaluate as doEvaluate, apply as doApply } from './evaluation'

export function* evaluate(node: es.Node, context: Context) {
  return yield* doEvaluate(node, context)
}

export function* apply(
  context: Context,
  fun: Closure | Value,
  args: Value[],
  node: es.CallExpression,
  thisContext?: Value
) {
  return yield* doApply(context, fun, args, node, thisContext)
}
