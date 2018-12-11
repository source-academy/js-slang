import * as es from 'estree'

import { ErrorSeverity, ErrorType, Rule, SourceError } from '../types'
import { reservedNames } from './noDeclareReserved'

export class NoAssignReservedError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.AssignmentExpression) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    return `Reserved word '${(this.node.left as any).name}'` + ' is not allowed as a name'
  }

  public elaborate() {
    return this.explain()
  }
}

const noAssignReserved: Rule<es.AssignmentExpression> = {
  name: 'no-assign-reserved',

  checkers: {
    AssignmentExpression(node: es.AssignmentExpression, ancestors: [es.Node]) {
      if (reservedNames.includes((node.left as es.Identifier).name)) {
        return [new NoAssignReservedError(node)]
      } else {
        return []
      }
    }
  }
}

export default noAssignReserved
