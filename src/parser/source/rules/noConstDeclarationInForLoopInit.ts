import type { ForStatement } from 'estree';
import { stripIndent } from '../../../utils/formatters';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

export class NoConstDeclarationInForLoopInit extends RuleError<ForStatement> {
  public override explain(): string {
    return 'Const declaration in init part of for statement is not allowed.';
  }
  public override elaborate(): string {
    return stripIndent`
      The init part of this statement cannot contain a const declaration, use a let declaration instead.
    `;
  }
}

export default defineRule('no-const-declaration-in-for-loop-init', {
  ForStatement(node) {
    if (node.init && node.init.type === 'VariableDeclaration' && node.init.kind === 'const') {
      return [new NoConstDeclarationInForLoopInit(node)];
    }

    return [];
  },
});
