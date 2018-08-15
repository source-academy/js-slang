import * as es from 'estree'

import { ErrorSeverity, ErrorType, Rule, SourceError } from '../types'

const specifiedLiterals = ['boolean', 'string', 'number']

export class NoUnspecifiedLiteral implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.Literal) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    /** 
     * A check is used for RegExp to ensure that only null and RegExp are caught.
     * Any other unspecified literal value should not be caught.
     */
    const literal = this.node.value === null ? 'null' 
      : this.node.value instanceof RegExp ? 'RegExp'
      : ''
    return (
      `A literal '${literal}' value is not allowed. Only string, boolean, and number literal values are allowed.`
    )
  }

  public elaborate() {
    return this.explain()
  }
}

const noUnspecifiedLiteral: Rule<es.Literal> = {
  name: 'no-unspecified-literal',
  checkers: {
    Literal(node: es.Literal) {
      if (!specifiedLiterals.includes(typeof node.value)) {
        return [new NoUnspecifiedLiteral(node)]
      } else {
        return []
      }
    }
  }
}

export default noUnspecifiedLiteral
