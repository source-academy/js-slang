import * as es from 'estree'

import { ErrorSeverity, ErrorType, Rule, SourceError } from '../types'

export class BracesAroundForError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.ForStatement) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    return 'Missing curly braces around "for" block'
  }

  public elaborate() {
    return 'TODO'
  }
}

const bracesAroundFor: Rule<es.ForStatement> = {
  name: 'braces-around-for',

  checkers: {
    ForStatement(node: es.ForStatement, ancestors: [es.Node]) {
      if (node.body.type !== 'BlockStatement') {
        return [new BracesAroundForError(node)]
      } else {
        return []
      }
    }
  }
}

export default bracesAroundFor
