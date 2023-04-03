import { generate } from 'astring'
import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'

export class NoVarError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.VariableDeclaration) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Variable declaration using "var" is not allowed.'
  }

  public elaborate() {
    const name = (this.node.declarations[0].id as es.Identifier).name
    const value = generate(this.node.declarations[0].init)

    return `Use keyword "let" instead, to declare a variable:\n\n\tlet ${name} = ${value};`
  }
}

const noVar: Rule<es.VariableDeclaration> = {
  name: 'no-var',

  checkers: {
    VariableDeclaration(node: es.VariableDeclaration, _ancestors: [es.Node]) {
      if (node.kind === 'var') {
        return [new NoVarError(node)]
      } else {
        return []
      }
    }
  }
}

export default noVar
