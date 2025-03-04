import type { TemplateLiteral } from 'estree'
import { type Rule, RuleError } from '../../types'

export class NoTemplateExpressionError extends RuleError<TemplateLiteral> {
  public explain() {
    return 'Expressions are not allowed in template literals (`multiline strings`)'
  }

  public elaborate() {
    return this.explain()
  }
}

const noTemplateExpression: Rule<TemplateLiteral> = {
  name: 'no-template-expression',
  testSnippets: [
    ['`\n`;', undefined],
    [
      'const x = 0; `${x}`;',
      'Line 1: Expressions are not allowed in template literals (`multiline strings`)'
    ]
  ],
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
