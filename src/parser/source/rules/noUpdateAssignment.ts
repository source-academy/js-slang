import type { AssignmentExpression, AssignmentOperator, BinaryOperator, LogicalOperator } from 'estree'
import { generate } from 'astring'

import { RuleError, type Rule } from '../../types'
import { NoUnspecifiedOperatorError, nonPermittedBinaryOperators } from './noUnspecifiedOperator'

export class NoUpdateAssignment extends RuleError<AssignmentExpression> {
  public explain() {
    return 'The assignment operator ' + this.node.operator + ' is not allowed. Use = instead.'
  }

  public elaborate() {
    const leftStr = generate(this.node.left)
    const rightStr = generate(this.node.right)
    const opStr = this.node.operator.slice(0, -1)

    return `\n\t${leftStr} = ${leftStr} ${opStr} ${rightStr};`
  }
}

const disallowedAssignmentOperators: AssignmentOperator[] = [
  // Some operators aren't recognized as valid operators
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  // "**=",
  '<<=',
  '>>=',
  '>>>=',
  '|=',
  '^=',
  '&='
  // "||=",
  // "&&=",
  // "??="
]

const testSnippets = disallowedAssignmentOperators.map(
  op =>
    [`a ${op} b;`, `Line 1: The assignment operator ${op} is not allowed. Use = instead.`] as [
      string,
      string
    ]
)

const noUpdateAssignment: Rule<AssignmentExpression> = {
  name: 'no-update-assignment',
  testSnippets,

  checkers: {
    AssignmentExpression(node) {
      if (node.operator !== '=') return [new NoUpdateAssignment(node)]

      const op = node.operator.slice(0, -1) as BinaryOperator | LogicalOperator
      if (nonPermittedBinaryOperators.includes(op)) {
        return [new NoUnspecifiedOperatorError(node)]
      }

      return []
    }
  }
}

export default noUpdateAssignment
