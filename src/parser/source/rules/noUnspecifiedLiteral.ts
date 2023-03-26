import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'

const specifiedLiterals = ['boolean', 'string', 'number']

export class NoUnspecifiedLiteral implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.Literal) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    /**
     * A check is used for RegExp to ensure that only RegExp are caught.
     * Any other unspecified literal value should not be caught.
     */
    const literal = this.node.value instanceof RegExp ? 'RegExp' : ''
    return `'${literal}' literals are not allowed.`
  }

  public elaborate() {
    return ''
  }
}

const noUnspecifiedLiteral: Rule<es.Literal> = {
  name: 'no-unspecified-literal',
  checkers: {
    Literal(node: es.Literal, _ancestors: [es.Node]) {
      if (node.value !== null && !specifiedLiterals.includes(typeof node.value)) {
        return [new NoUnspecifiedLiteral(node)]
      } else {
        return []
      }
    }
  }
}

export default noUnspecifiedLiteral
