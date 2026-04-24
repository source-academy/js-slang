import type { MemberExpression } from 'estree';
import { Chapter } from '../../../langs';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

export class NoDotAbbreviationError extends RuleError<MemberExpression> {
  public override explain() {
    return 'Dot abbreviations are not allowed.';
  }

  public override elaborate() {
    return `Source doesn't use object-oriented programming, so you don't need any dots in your code (except decimal \
        points in numbers).`;
  }
}

export default defineRule(
  'no-dot-abbreviation',
  {
    MemberExpression(node) {
      if (!node.computed) {
        return [new NoDotAbbreviationError(node)];
      } else {
        return [];
      }
    },
  },
  Chapter.LIBRARY_PARSER,
);
