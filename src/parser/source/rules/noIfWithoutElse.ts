import { generate } from 'astring'
import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { Chapter, ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'
import { stripIndent } from '../../../utils/formatters'

export class NoIfWithoutElseError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.IfStatement) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Missing "else" in "if-else" statement.'
  }

  public elaborate() {
    return stripIndent`
      This "if" block requires corresponding "else" block which will be
      evaluated when ${generate(this.node.test)} expression evaluates to false.

      Later in the course we will lift this restriction and allow "if" without
      else.
    `
  }
}

const noIfWithoutElse: Rule<es.IfStatement> = {
  name: 'no-if-without-else',
  disableFromChapter: Chapter.SOURCE_3,
  checkers: {
    IfStatement(node: es.IfStatement, _ancestors: [es.Node]) {
      if (!node.alternate) {
        return [new NoIfWithoutElseError(node)]
      } else {
        return []
      }
    }
  }
}

export default noIfWithoutElse
