import * as es from 'estree'
import * as constants from '../constants'


import { ErrorSeverity, ErrorType, Rule, SourceError } from '../types'

export class NoUnspecifiedCompoundAssignmentError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR
  public unspecifiedOperator: string

  constructor(public node: es.AssignmentExpression) {
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

const noUnspecifiedCompoundAssignment: Rule<es.AssignmentExpression> = {
  name: 'no-unspecified-compound-assignment',
  disableOn: constants.COMPOUND_ASSIGNMENT_ALLOWED_WEEK,

  checkers: {
    AssignmentExpression(node: es.AssignmentExpression) {
      const permittedOperators = ['=']
      if (!permittedOperators.includes(node.operator)) {
        return [new NoUnspecifiedCompoundAssignmentError(node)]
      } else {
        return []
      }
    }
  }
}

export default noUnspecifiedCompoundAssignment
