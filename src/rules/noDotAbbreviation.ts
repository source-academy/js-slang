import * as es from 'estree'

import { SourceError, Rule, ErrorSeverity, ErrorType } from '../types'

export class noDotAbbreviationError implements SourceError {
  type = ErrorType.SYNTAX
  severity = ErrorSeverity.ERROR

  constructor(public node: es.MemberExpression) {}

  get location() {
    return this.node.loc!
  }

  explain() {
    return "Dot abbreviations are not allowed."
  }

  elaborate() {
    return ""
  }
}

const noDotAbbreviation: Rule<es.MemberExpression> = {
  name: 'no-dot-abbreviation',

  checkers: {
    MemberExpression(node: es.MemberExpression, ancestors: [es.Node]) {
      if (!node.computed) {
        return [new noDotAbbreviationError(node)]
      } else {
        return []
      }
    }
  }
}

export default noDotAbbreviation
