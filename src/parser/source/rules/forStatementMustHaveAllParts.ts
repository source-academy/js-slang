import type { ForStatement } from 'estree';
import { stripIndent } from '../../../utils/formatters';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

type ForStatementParts = keyof ForStatement;
const forStatementParts: ForStatementParts[] = ['init', 'test', 'update'];

export class ForStatmentMustHaveAllParts extends RuleError<ForStatement> {
  constructor(
    node: ForStatement,
    private readonly missingParts: ForStatementParts[],
  ) {
    super(node);
  }

  public override explain() {
    return `Missing ${this.missingParts.join(', ')} expression${
      this.missingParts.length === 1 ? '' : 's'
    } in for statement.`;
  }

  public override elaborate() {
    return stripIndent`
      This for statement requires all three parts (initialiser, test, update) to be present.
    `;
  }
}

export default defineRule('for-statement-must-have-all-parts', {
  ForStatement(node) {
    const missingParts = forStatementParts.filter(part => node[part] === null);
    if (missingParts.length > 0) {
      return [new ForStatmentMustHaveAllParts(node, missingParts)];
    } else {
      return [];
    }
  },
});
