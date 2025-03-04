import { generate } from 'astring'
import type { AssignmentExpression } from 'estree'
import { type Rule, RuleError } from '../../types'

export class NoUpdateAssignment extends RuleError<AssignmentExpression> {
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

const noUpdateAssignment: Rule<AssignmentExpression> = {
  name: 'no-update-assignment',

  checkers: {
    AssignmentExpression(node) {
      if (node.operator !== '=') {
        return [new NoUpdateAssignment(node)]
      } else {
        return []
      }
    }
  }
}

export default noUpdateAssignment
