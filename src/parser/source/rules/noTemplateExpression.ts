import type es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, type SourceError } from '../../../types'
import type { Rule } from '../../types'

export class NoTemplateExpressionError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.TemplateLiteral) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Expressions are not allowed in template literals (`multiline strings`)'
  }

  public elaborate() {
    return this.explain()
  }
}

const noTemplateExpression: Rule<es.TemplateLiteral> = {
  name: 'no-template-expression',
  testSnippets: [
    ['`\n`;', undefined],
    [
      'const x = 0; `${x}`;',
      'Line 1: Expressions are not allowed in template literals (`multiline strings`)'
    ]
  ],
  checkers: {
    TemplateLiteral(node: es.TemplateLiteral) {
      if (node.expressions.length > 0) {
        return [new NoTemplateExpressionError(node)]
      } else {
        return []
      }
    }
  }
}

export default noTemplateExpression
