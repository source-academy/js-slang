import type es from 'estree'

import { UNKNOWN_LOCATION } from '../constants'
import { ErrorSeverity, ErrorType, type SourceError } from './base'

export class NoAssignmentToForVariable implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.AssignmentExpression) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Assignment to a for loop variable in the for loop is not allowed.'
  }

  public elaborate() {
    return this.explain()
  }
}
