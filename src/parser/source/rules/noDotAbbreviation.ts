import type es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { Chapter, ErrorSeverity, ErrorType, type SourceError } from '../../../types'
import type { Rule } from '../../types'

const errorMessage = 'Dot abbreviations are not allowed.'

export class NoDotAbbreviationError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.MemberExpression) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return errorMessage
  }

  public elaborate() {
    return `Source doesn't use object-oriented programming, so you don't need any dots in your code (except decimal \
        points in numbers).`
  }
}

const noDotAbbreviation: Rule<es.MemberExpression> = {
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
    MemberExpression(node: es.MemberExpression) {
      if (!node.computed) {
        return [new NoDotAbbreviationError(node)]
      } else {
        return []
      }
    }
  }
}

export default noDotAbbreviation
