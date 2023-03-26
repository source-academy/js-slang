import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'
import { stripIndent } from '../../../utils/formatters'

export class NoImplicitDeclareUndefinedError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.Identifier) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Missing value in variable declaration.'
  }

  public elaborate() {
    return stripIndent`
      A variable declaration assigns a value to a name.
      For instance, to assign 20 to ${this.node.name}, you can write:

        let ${this.node.name} = 20;

        ${this.node.name} + ${this.node.name}; // 40
    `
  }
}

const noImplicitDeclareUndefined: Rule<es.VariableDeclaration> = {
  name: 'no-implicit-declare-undefined',

  checkers: {
    VariableDeclaration(node: es.VariableDeclaration, _ancestors: [es.Node]) {
      const errors: SourceError[] = []
      for (const decl of node.declarations) {
        if (!decl.init) {
          errors.push(new NoImplicitDeclareUndefinedError(decl.id as es.Identifier))
        }
      }
      return errors
    }
  }
}

export default noImplicitDeclareUndefined
