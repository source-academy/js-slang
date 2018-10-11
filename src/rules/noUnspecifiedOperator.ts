import * as es from 'estree'

import { ErrorSeverity, ErrorType, Rule, SourceError } from '../types'

export class NoUnspecifiedOperatorError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR
  public unspecifiedOperator: string

  constructor(public node: es.BinaryExpression | es.UnaryExpression | es.AssignmentExpression) {
    this.unspecifiedOperator = node.operator
  }

  get location() {
    return this.node.loc!
  }

  public explain() {
    return `Operator '${this.unspecifiedOperator}' is not allowed.`
  }

  public elaborate() {
    return this.explain()
  }
}

const noUnspecifiedOperator: Rule<es.BinaryExpression | es.UnaryExpression | es.AssignmentExpression> = {
  name: 'no-unspecified-operator',

  checkers: {
    BinaryExpression(node: es.BinaryExpression) {
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
        '||',
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
    },
    AssignmentExpression(node: es.AssignmentExpression) {
      const permittedOperators = ['=', '+=', '-=', '*=', '/=', '%=']
      if (!permittedOperators.includes(node.operator)) {
        return [new NoUnspecifiedOperatorError(node)]
      } else {
        return []
      }
    }
  }
}

export default noUnspecifiedOperator
