import type { Identifier } from 'estree';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

export class NoEval extends RuleError<Identifier> {
  public override explain() {
    return `eval is not allowed.`;
  }

  public override elaborate() {
    return this.explain();
  }
}

export default defineRule('no-eval', {
  Identifier(node) {
    if (node.name === 'eval') {
      return [new NoEval(node)];
    } else {
      return [];
    }
  },
});
