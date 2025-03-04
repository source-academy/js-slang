import { generate } from 'astring'
import type { IfStatement } from 'estree'
import { Chapter } from '../../../types'
import { type Rule, RuleError } from '../../types'
import { stripIndent } from '../../../utils/formatters'

export class NoIfWithoutElseError extends RuleError<IfStatement> {
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

const noIfWithoutElse: Rule<IfStatement> = {
  name: 'no-if-without-else',
  disableFromChapter: Chapter.SOURCE_3,
  testSnippets: [
    [
      `
      function f() {
        if (true) {
          return true;
        }
        return false;
      }
      `,
      'Line 3: Missing "else" in "if-else" statement.'
    ]
  ],
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
