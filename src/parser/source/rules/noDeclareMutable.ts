import { generate } from 'astring'
import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { Chapter, ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'

const mutableDeclarators = ['let', 'var']

export class NoDeclareMutableError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.VariableDeclaration) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return (
      'Mutable variable declaration using keyword ' + `'${this.node.kind}'` + ' is not allowed.'
    )
  }

  public elaborate() {
    const name = (this.node.declarations[0].id as es.Identifier).name
    const value = generate(this.node.declarations[0].init)

    return `Use keyword "const" instead, to declare a constant:\n\n\tconst ${name} = ${value};`
  }
}

const noDeclareMutable: Rule<es.VariableDeclaration> = {
  name: 'no-declare-mutable',
  disableFromChapter: Chapter.SOURCE_3,

  checkers: {
    VariableDeclaration(node: es.VariableDeclaration, _ancestors: [es.Node]) {
      if (mutableDeclarators.includes(node.kind)) {
        return [new NoDeclareMutableError(node)]
      } else {
        return []
      }
    }
  }
}

export default noDeclareMutable
