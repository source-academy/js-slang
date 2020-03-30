import * as es from 'estree'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import { Context, Value } from '../types'

import { Evaluator } from './evaluatorUtils'
import { getEvaluators } from './evaluators'

export class ApplicativeOrderEvaluationInterpreter {
  evaluators: { [nodeType: string]: Evaluator<es.Node> };

  *visit(context: Context, node: es.Node) {
    checkEditorBreakpoints(context, node)
    context.runtime.nodes.unshift(node)
    yield context
  }

  *leave(context: Context) {
    context.runtime.break = false
    context.runtime.nodes.shift()
    yield context
  }

  *evaluate(node: es.Node, context: Context): IterableIterator<Value> {
    yield* this.visit(context, node)
    const result = yield* this.evaluators[node.type](node, context)
    yield* this.leave(context)
    return result
  }

  constructor() {
    this.evaluators = getEvaluators(this.evaluate.bind(this), this.evaluate.bind(this))
  }
}
