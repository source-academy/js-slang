import type es from 'estree'

import { ErrorSeverity, ErrorType, SourceErrorWithNode } from './base'

export class NoAssignmentToForVariableError extends SourceErrorWithNode<es.AssignmentExpression> {
  type = ErrorType.SYNTAX
  severity = ErrorSeverity.ERROR

  public override explain() {
    return 'Assignment to a for loop variable within the body of the for loop is not allowed.'
  }

  public override elaborate() {
    return this.explain()
  }
}
