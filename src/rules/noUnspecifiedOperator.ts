import * as es from 'estree'

import { ErrorSeverity, ErrorType, Rule, SourceError } from '../types'

export class NoUnspecifiedOperatorError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR
  public unspecifiedOperator: string

  constructor(public node: es.BinaryExpression | es.UnaryExpression) {
    this.unspecifiedOperator = node.operator
  }

  get location() {
    return this.node.loc!
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
    BinaryExpression(node: es.BinaryExpression, ancestors: [es.Node]) {
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
      const permittedOperators = ['-', '!']
      if (!permittedOperators.includes(node.operator)) {
        return [new NoUnspecifiedOperatorError(node)]
      } else {
        return []
      }
    }
  }
}

export default noUnspecifiedOperator
