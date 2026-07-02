import type { TemplateLiteral } from 'estree';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

export class NoTemplateExpressionError extends RuleError<TemplateLiteral> {
  public override explain() {
    return 'Expressions are not allowed in template literals (`multiline strings`)';
  }

  public override elaborate() {
    return this.explain();
  }
}

export default defineRule('no-template-expression', {
  TemplateLiteral(node) {
    if (node.expressions.length > 0) {
      return [new NoTemplateExpressionError(node)];
    } else {
      return [];
    }
  },
});
