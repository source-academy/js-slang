import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { Chapter, ErrorSeverity, ErrorType, Node, SourceError } from '../../../types'
import { Rule } from '../../types'

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
    MemberExpression(node: es.MemberExpression, _ancestors: [Node]) {
      if (!node.computed) {
        return [new NoDotAbbreviationError(node)]
      } else {
        return []
      }
    }
  }
}

export default noDotAbbreviation
