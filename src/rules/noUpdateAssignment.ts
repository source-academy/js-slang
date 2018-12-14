import * as es from 'estree'

import { ErrorSeverity, ErrorType, Rule, SourceError } from '../types'

export class NoUpdateAssignment implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.AssignmentExpression) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    return 'The assignment operator ' + this.node.operator + ' is not allowed. Use = instead'
  }

  public elaborate() {
    return ''
  }
}

const noUpdateAssignment: Rule<es.AssignmentExpression> = {
  name: 'no-update-assignment',

  checkers: {
    AssignmentExpression(node: es.AssignmentExpression, ancestors: [es.Node]) {
      if (node.operator !== '=') {
        return [new NoUpdateAssignment(node)]
      } else {
        return []
      }
    }
  }
}

export default noUpdateAssignment
