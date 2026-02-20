import type { AssignmentExpression, BinaryExpression, UnaryExpression } from 'estree'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

type ExpressionNodeType = AssignmentExpression | BinaryExpression | UnaryExpression

export class NoUnspecifiedOperatorError<T extends ExpressionNodeType> extends RuleError<T> {
  public readonly unspecifiedOperator: T['operator']

  constructor(node: T) {
    super(node)
    this.unspecifiedOperator = node.operator
  }

  public override explain() {
    return `Operator '${this.unspecifiedOperator}' is not allowed.`
  }

  public override elaborate() {
    return ''
  }
}

export class StrictEqualityError extends NoUnspecifiedOperatorError<BinaryExpression> {
  public override explain() {
    if (this.node.operator === '==') {
      return 'Use === instead of ==.'
    } else {
      return 'Use !== instead of !=.'
    }
  }

  public override elaborate() {
    return '== and != are not valid operators.'
  }
}

const noUnspecifiedOperator: Rule<BinaryExpression | UnaryExpression> = {
  name: 'no-unspecified-operator',

  checkers: {
    BinaryExpression(node) {
      const permittedOperators: BinaryExpression['operator'][] = [
        '+',
        '-',
        '*',
        '/',
        '%',
        '===',
        '!==',
        '<',
        '>',
        '<=',
        '>='
        // '&&',
        // '||'
      ]

      if (node.operator === '!=' || node.operator === '==') {
        return [new StrictEqualityError(node)]
      } else if (!permittedOperators.includes(node.operator)) {
        return [new NoUnspecifiedOperatorError(node)]
      } else {
        return []
      }
    },
    UnaryExpression(node) {
      const permittedOperators = ['-', '!', 'typeof']
      if (!permittedOperators.includes(node.operator)) {
        return [new NoUnspecifiedOperatorError(node)]
      } else {
        return []
      }
    }
  }
}

export default noUnspecifiedOperator
