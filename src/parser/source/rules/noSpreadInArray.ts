import type { SpreadElement } from 'estree';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

export class NoSpreadInArray extends RuleError<SpreadElement> {
  public explain() {
    return 'Spread syntax is not allowed in arrays.';
  }

  public elaborate() {
    return '';
  }
}

export default defineRule('no-spread-in-arrays', {
  SpreadElement(node, ancestors) {
    const parent = ancestors[ancestors.length - 2];

    if (parent.type === 'CallExpression') {
      return [];
    } else {
      return [new NoSpreadInArray(node)];
    }
  },
});
