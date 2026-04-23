import { generate } from 'astring';
import type { IfStatement } from 'estree';
import { Chapter } from '../../../langs';
import { stripIndent } from '../../../utils/formatters';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

export class NoIfWithoutElseError extends RuleError<IfStatement> {
  public override explain() {
    return 'Missing "else" in "if-else" statement.';
  }

  public override elaborate() {
    return stripIndent`
      This "if" block requires corresponding "else" block which will be
      evaluated when ${generate(this.node.test)} expression evaluates to false.

      Later in the course we will lift this restriction and allow "if" without
      else.
    `;
  }
}

export default defineRule(
  'no-if-without-else',
  {
    IfStatement(node) {
      if (!node.alternate) {
        return [new NoIfWithoutElseError(node)];
      } else {
        return [];
      }
    },
  },
  Chapter.SOURCE_3,
);
