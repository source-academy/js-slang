import type { Literal } from 'estree';
import { Chapter } from '../../../langs';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

export class NoNullError extends RuleError<Literal> {
  public override explain() {
    return `null literals are not allowed.`;
  }

  public override elaborate() {
    return "They're not part of the Source §1 specs.";
  }
}

export default defineRule(
  'no-null',
  {
    Literal(node) {
      if (node.value === null) {
        return [new NoNullError(node)];
      } else {
        return [];
      }
    },
  },
  Chapter.SOURCE_2,
);
