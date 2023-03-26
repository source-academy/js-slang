import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'

export class NoSpreadInArray implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.SpreadElement) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Spread syntax is not allowed in arrays.'
  }

  public elaborate() {
    return ''
  }
}

const noSpreadInArray: Rule<es.SpreadElement> = {
  name: 'no-assignment-expression',

  checkers: {
    SpreadElement(node: es.SpreadElement, ancestors: [es.Node]) {
      const parent = ancestors[ancestors.length - 2]

      if (parent.type === 'CallExpression') {
        return []
      } else {
        return [new NoSpreadInArray(node)]
      }
    }
  }
}

export default noSpreadInArray
