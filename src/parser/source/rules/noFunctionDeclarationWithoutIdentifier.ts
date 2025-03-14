import type { FunctionDeclaration } from 'estree'
import type { Rule } from '../../types'
import { RuleError } from '../../errors'

export class NoFunctionDeclarationWithoutIdentifierError extends RuleError<FunctionDeclaration> {
  public explain() {
    return `The 'function' keyword needs to be followed by a name.`
  }

  public elaborate() {
    return 'Function declarations without a name are similar to function expressions, which are banned.'
  }
}

const noFunctionDeclarationWithoutIdentifier: Rule<FunctionDeclaration> = {
  name: 'no-function-declaration-without-identifier',

  checkers: {
    FunctionDeclaration(node) {
      if (node.id === null) {
        return [new NoFunctionDeclarationWithoutIdentifierError(node)]
      }
      return []
    }
  }
}

export default noFunctionDeclarationWithoutIdentifier
