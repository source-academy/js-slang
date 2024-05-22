import type es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, type SourceError } from '../../../types'
import type { Rule } from '../../types'

export class StrictEqualityError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.BinaryExpression) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    if (this.node.operator === '==') {
      return 'Use === instead of ==.'
    } else {
      return 'Use !== instead of !=.'
    }
  }

  public elaborate() {
    return '== and != are not valid operators.'
  }
}

const strictEquality: Rule<es.BinaryExpression> = {
  name: 'strict-equality',

  testSnippets: [
    ['const x = 1 == 2;', 'Line 1: Use === instead of ==.'],
    ['const x = 1 != 2;', 'Line 1: Use !== instead of !=.']
  ],

  checkers: {
    BinaryExpression(node: es.BinaryExpression) {
      if (node.operator === '==' || node.operator === '!=') {
        return [new StrictEqualityError(node)]
      } else {
        return []
      }
    }
  }
}

export default strictEquality
