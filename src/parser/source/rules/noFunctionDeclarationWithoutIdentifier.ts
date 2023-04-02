import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'

export class NoFunctionDeclarationWithoutIdentifierError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.FunctionDeclaration) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `The 'function' keyword needs to be followed by a name.`
  }

  public elaborate() {
    return 'Function declarations without a name are similar to function expressions, which are banned.'
  }
}

const noFunctionDeclarationWithoutIdentifier: Rule<es.FunctionDeclaration> = {
  name: 'no-function-declaration-without-identifier',

  checkers: {
    FunctionDeclaration(node: es.FunctionDeclaration, _ancestors: es.Node[]): SourceError[] {
      if (node.id === null) {
        return [new NoFunctionDeclarationWithoutIdentifierError(node)]
      }
      return []
    }
  }
}

export default noFunctionDeclarationWithoutIdentifier
