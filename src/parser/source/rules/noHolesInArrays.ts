import type { ArrayExpression } from 'estree';
import { stripIndent } from '../../../utils/formatters';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

export class NoHolesInArrays extends RuleError<ArrayExpression> {
  public override explain() {
    return `No holes are allowed in array literals.`;
  }

  public override elaborate() {
    return stripIndent`
      No holes (empty slots with no content inside) are allowed in array literals.
      You probably have an extra comma, which creates a hole.
    `;
  }
}

export default defineRule('no-holes-in-arrays', {
  ArrayExpression(node) {
    return node.elements.some(x => x === null) ? [new NoHolesInArrays(node)] : [];
  },
});
