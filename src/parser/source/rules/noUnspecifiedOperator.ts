import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'

export class NoUnspecifiedOperatorError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR
  public unspecifiedOperator: string

  constructor(public node: es.BinaryExpression | es.UnaryExpression) {
    this.unspecifiedOperator = node.operator
  }

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Operator '${this.unspecifiedOperator}' is not allowed.`
  }

  public elaborate() {
    return ''
  }
}

const noUnspecifiedOperator: Rule<es.BinaryExpression | es.UnaryExpression> = {
  name: 'no-unspecified-operator',

  checkers: {
    BinaryExpression(node: es.BinaryExpression, _ancestors: [es.Node]) {
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
      if (!permittedOperators.includes(node.operator)) {
        return [new NoUnspecifiedOperatorError(node)]
      } else {
        return []
      }
    },
    UnaryExpression(node: es.UnaryExpression) {
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
