import type { MaybeNamedFunctionDeclaration } from 'estree';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

export class NoFunctionDeclarationWithoutIdentifierError extends RuleError<MaybeNamedFunctionDeclaration> {
  public override explain() {
    return `The 'function' keyword needs to be followed by a name.`;
  }

  public override elaborate() {
    return 'Function declarations without a name are similar to function expressions, which are banned.';
  }
}

export default defineRule('no-function-declaration-without-identifier', {
  FunctionDeclaration(node) {
    if (node.id === null) {
      return [new NoFunctionDeclarationWithoutIdentifierError(node)];
    }
    return [];
  },
});
