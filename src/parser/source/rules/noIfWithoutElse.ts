import { generate } from 'astring'
import type { IfStatement } from 'estree'
import { Chapter } from '../../../langs'
import { stripIndent } from '../../../utils/formatters'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

export class NoIfWithoutElseError extends RuleError<IfStatement> {
  public override explain() {
    return 'Missing "else" in "if-else" statement.'
  }

  public override elaborate() {
    return stripIndent`
      This "if" block requires corresponding "else" block which will be
      evaluated when ${generate(this.node.test)} expression evaluates to false.

      Later in the course we will lift this restriction and allow "if" without
      else.
    `
  }
}

const noIfWithoutElse: Rule<IfStatement> = {
  name: 'no-if-without-else',
  disableFromChapter: Chapter.SOURCE_3,
  checkers: {
    IfStatement(node) {
      if (!node.alternate) {
        return [new NoIfWithoutElseError(node)]
      } else {
        return []
      }
    }
  }
}

export default noIfWithoutElse
