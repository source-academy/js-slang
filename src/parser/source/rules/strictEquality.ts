import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Node, SourceError } from '../../../types'
import { Rule } from '../../types'

export class StrictEqualityError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.BinaryExpression) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    if (this.node.operator === '==') {
      return 'Use === instead of =='
    } else {
      return 'Use !== instead of !='
    }
  }

  public elaborate() {
    return '== and != is not a valid operator'
  }
}

const strictEquality: Rule<es.BinaryExpression> = {
  name: 'strict-equality',

  checkers: {
    BinaryExpression(node: es.BinaryExpression, _ancestors: [Node]) {
      if (node.operator === '==' || node.operator === '!=') {
        return [new StrictEqualityError(node)]
      } else {
        return []
      }
    }
  }
}

export default strictEquality
