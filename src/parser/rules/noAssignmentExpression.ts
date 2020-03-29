import { generate } from 'astring'
import * as es from 'estree'

import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../types'

export class NoAssignmentExpression implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.AssignmentExpression) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    return 'Assignment inside an expression is not allowed. Only assignment in a statement is allowed.'
  }

  public elaborate() {
    function lastAssignmentNode(theNode: es.AssignmentExpression): es.AssignmentExpression {
      if (theNode.right.type === 'AssignmentExpression') {
        return lastAssignmentNode(theNode.right)
      } else {
        return theNode
      }
    }

    const lastNode = lastAssignmentNode(this.node)
    const leftStr = generate(this.node.left)
    const rightStr = generate(lastNode.right)

    const elabStr = `Try moving this to another line:\n\n\t${leftStr} = ${rightStr};`

    return elabStr
  }
}

const noAssignmentExpression: Rule<es.AssignmentExpression> = {
  name: 'no-assignment-expression',

  checkers: {
    AssignmentExpression(node: es.AssignmentExpression, ancestors: [es.Node]) {
      const parent = ancestors[ancestors.length - 2]
      const parentType = parent.type

      if (
        parentType === 'ExpressionStatement' ||
        // Only permitted in a for loop if this node was its init or update expression
        (parentType === 'ForStatement' &&
          ((parent as es.ForStatement).init === node ||
            (parent as es.ForStatement).update === node))
      ) {
        return []
      } else {
        return [new NoAssignmentExpression(node)]
      }
    }
  }
}

export default noAssignmentExpression
