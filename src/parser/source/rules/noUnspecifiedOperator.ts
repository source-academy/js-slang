import type { AssignmentExpression, BinaryExpression, UnaryExpression } from 'estree'
import type { Rule } from '../../types'
import { RuleError } from '../../errors'

type ExpressionNodeType = AssignmentExpression | BinaryExpression | UnaryExpression

export class NoUnspecifiedOperatorError<T extends ExpressionNodeType> extends RuleError<T> {
  public unspecifiedOperator: T['operator']

  constructor(node: T) {
    super(node)
    this.unspecifiedOperator = node.operator
  }

  public explain() {
    return `Operator '${this.unspecifiedOperator}' is not allowed.`
  }

  public elaborate() {
    return ''
  }
}

export class StrictEqualityError extends NoUnspecifiedOperatorError<BinaryExpression> {
  public explain() {
    if (this.node.operator === '==') {
      return 'Use === instead of =='
    } else {
      return 'Use !== instead of !='
    }
  }

  public elaborate() {
    return '== and != is not a valid operator'
  }
}

const noUnspecifiedOperator: Rule<BinaryExpression | UnaryExpression> = {
  name: 'no-unspecified-operator',

  checkers: {
    BinaryExpression(node) {
      const permittedOperators = [
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
        '>=',
        '&&',
        '||'
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
