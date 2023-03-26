import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'

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

  checkers: {
    TemplateLiteral(node: es.TemplateLiteral, _ancestors: [es.Node]) {
      if (node.expressions.length > 0) {
        return [new NoTemplateExpressionError(node)]
      } else {
        return []
      }
    }
  }
}

export default noTemplateExpression
