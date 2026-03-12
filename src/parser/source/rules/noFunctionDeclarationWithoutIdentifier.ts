import type { MaybeNamedFunctionDeclaration } from 'estree'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

export class NoFunctionDeclarationWithoutIdentifierError extends RuleError<MaybeNamedFunctionDeclaration> {
  public override explain() {
    return `The 'function' keyword needs to be followed by a name.`
  }

  public override elaborate() {
    return 'Function declarations without a name are similar to function expressions, which are banned.'
  }
}

const noFunctionDeclarationWithoutIdentifier: Rule<MaybeNamedFunctionDeclaration> = {
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
