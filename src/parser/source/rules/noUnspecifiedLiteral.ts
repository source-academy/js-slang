import type { Literal } from 'estree';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';
import { typeOf } from '../../../utils/rttc';

const specifiedLiterals = ['boolean', 'string', 'number'];

export class NoUnspecifiedLiteral extends RuleError<Literal> {
  public explain() {
    /**
     * A check is used for RegExp to ensure that only RegExp are caught.
     * Any other unspecified literal value should not be caught.
     */
    const literal = typeOf(this.node.value);
    return `'${literal}' literals are not allowed.`;
  }

  public elaborate() {
    return '';
  }
}

export default defineRule('no-unspecified-literal', {
  Literal(node) {
    if (node.value !== null && !specifiedLiterals.includes(typeof node.value)) {
      return [new NoUnspecifiedLiteral(node)];
    } else {
      return [];
    }
  },
});
