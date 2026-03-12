import type { TemplateLiteral } from 'estree'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

export class NoTemplateExpressionError extends RuleError<TemplateLiteral> {
  public override explain() {
    return 'Expressions are not allowed in template literals (`multiline strings`)'
  }

  public override elaborate() {
    return this.explain()
  }
}

const noTemplateExpression: Rule<TemplateLiteral> = {
  name: 'no-template-expression',

  checkers: {
    TemplateLiteral(node) {
      if (node.expressions.length > 0) {
        return [new NoTemplateExpressionError(node)]
      } else {
        return []
      }
    }
  }
}

export default noTemplateExpression
