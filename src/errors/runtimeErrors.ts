import { generate } from 'astring'
import type es from 'estree'
import type { Value } from '../types'
import type { Node } from '../utils/ast/node'
import { stringify } from '../utils/stringify'
import { RuntimeSourceError } from './errorBase'

export class CallingNonFunctionValue extends RuntimeSourceError {
  constructor(
    private callee: Value,
    private node: Node
  ) {
    super(node)
  }

  public explain() {
    return `Calling non-function value ${stringify(this.callee)}.`
  }

  public elaborate() {
    const calleeVal = this.callee
    const calleeStr = stringify(calleeVal)
    let argStr = ''

    const callArgs = (this.node as es.CallExpression).arguments

    argStr = callArgs.map(generate).join(', ')

    const elabStr = `Because ${calleeStr} is not a function, you cannot run ${calleeStr}(${argStr}).`
    const multStr = `If you were planning to perform multiplication by ${calleeStr}, you need to use the * operator.`

    if (Number.isFinite(calleeVal)) {
      return `${elabStr} ${multStr}`
    } else {
      return elabStr
    }
  }
}
