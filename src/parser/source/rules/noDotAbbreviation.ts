import type { MemberExpression } from 'estree'
import { Chapter } from '../../../langs'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

export class NoDotAbbreviationError extends RuleError<MemberExpression> {
  public explain() {
    return 'Dot abbreviations are not allowed.'
  }

  public elaborate() {
    return `Source doesn't use object-oriented programming, so you don't need any dots in your code (except decimal \
        points in numbers).`
  }
}

const noDotAbbreviation: Rule<MemberExpression> = {
  name: 'no-dot-abbreviation',

  disableFromChapter: Chapter.LIBRARY_PARSER,

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
