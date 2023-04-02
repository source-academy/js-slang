import { generate } from 'astring'
import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'

export class NoUpdateAssignment implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.AssignmentExpression) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'The assignment operator ' + this.node.operator + ' is not allowed. Use = instead.'
  }

  public elaborate() {
    const leftStr = generate(this.node.left)
    const rightStr = generate(this.node.right)
    const newOpStr = this.node.operator.slice(0, -1)

    if (newOpStr === '+' || newOpStr === '-' || newOpStr === '/' || newOpStr === '*') {
      const elabStr = `\n\t${leftStr} = ${leftStr} ${newOpStr} ${rightStr};`

      return elabStr
    } else {
      return ''
    }
  }
}

const noUpdateAssignment: Rule<es.AssignmentExpression> = {
  name: 'no-update-assignment',

  checkers: {
    AssignmentExpression(node: es.AssignmentExpression, _ancestors: [es.Node]) {
      if (node.operator !== '=') {
        return [new NoUpdateAssignment(node)]
      } else {
        return []
      }
    }
  }
}

export default noUpdateAssignment
