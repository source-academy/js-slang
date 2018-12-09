import * as es from 'estree'

import { SourceError, Rule, ErrorSeverity, ErrorType } from '../types'

export class NoAssignmentExpression implements SourceError {
  type = ErrorType.SYNTAX
  severity = ErrorSeverity.ERROR

  constructor(public node: es.AssignmentExpression) {}

  get location() {
    return this.node.loc!
  }

  explain() {
    return "Assignment inside an expression is not allowed. Only assignment in a statement is allowed."
  }

  elaborate() {
    return ""
  }
}

const noAssignmentExpression: Rule<es.AssignmentExpression> = {
  name: 'no-assignment-expression',

  checkers: {
    AssignmentExpression(node: es.AssignmentExpression, ancestors: [es.Node]) {
      let parent = ancestors[ancestors.length - 2]
      let parent_type = parent.type

      if (parent_type === 'ExpressionStatement' ||
        // Only permitted in a for loop if this node was its init or update expression
        (parent_type === 'ForStatement' &&
          ((<es.ForStatement> parent).init === node ||
            (<es.ForStatement> parent).update === node))) {
        return []
      } else {
        return [new NoAssignmentExpression(node)]
      }
    }
  }
}

export default noAssignmentExpression
