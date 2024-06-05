import type { MemberExpression } from 'estree'
import { Chapter } from '../../../types'
import { RuleError, type Rule } from '../../types'

const errorMessage = 'Dot abbreviations are not allowed.'

export class NoDotAbbreviationError extends RuleError<MemberExpression> {
  public explain() {
    return errorMessage
  }

  public elaborate() {
    return `Source doesn't use object-oriented programming, so you don't need any dots in your code (except decimal \
        points in numbers).`
  }
}

const noDotAbbreviation: Rule<MemberExpression> = {
  name: 'no-dot-abbreviation',

  disableFromChapter: Chapter.LIBRARY_PARSER,
  testSnippets: [
    [
      `
        const obj = {};
        obj.o;
      `,
      `Line 3: ${errorMessage}`
    ]
  ],

  checkers: {
    MemberExpression(node) {
      if (!node.computed) {
        return [new NoDotAbbreviationError(node)]
      } else {
        return []
      }
    }
  }
}

export default noDotAbbreviation
