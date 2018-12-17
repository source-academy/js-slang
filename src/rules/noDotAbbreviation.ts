import * as es from 'estree'

import { ErrorSeverity, ErrorType, Rule, SourceError } from '../types'

export class NoDotAbbreviationError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.MemberExpression) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    return 'Dot abbreviations are not allowed.'
  }

  public elaborate() {
    return ''
  }
}

const noDotAbbreviation: Rule<es.MemberExpression> = {
  name: 'no-dot-abbreviation',

  disableOn: 100,

  checkers: {
    MemberExpression(node: es.MemberExpression, ancestors: [es.Node]) {
      if (!node.computed) {
        return [new NoDotAbbreviationError(node)]
      } else {
        return []
      }
    }
  }
}

export default noDotAbbreviation
