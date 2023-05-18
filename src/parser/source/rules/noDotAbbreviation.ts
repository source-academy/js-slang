import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { Chapter, ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'

export class NoDotAbbreviationError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.MemberExpression) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Dot abbreviations are not allowed.'
  }

  public elaborate() {
    return `Source doesn't use object-oriented programming, so you don't need any dots in your code (except decimal \
        points in numbers).`
  }
}

const noDotAbbreviation: Rule<es.MemberExpression> = {
  name: 'no-dot-abbreviation',

  disableFromChapter: Chapter.LIBRARY_PARSER,

  checkers: {
    MemberExpression(node: es.MemberExpression, _ancestors: [es.Node]) {
      if (!node.computed) {
        return [new NoDotAbbreviationError(node)]
      } else {
        return []
      }
    }
  }
}

export default noDotAbbreviation
