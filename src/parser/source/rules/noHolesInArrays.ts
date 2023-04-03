import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'
import { stripIndent } from '../../../utils/formatters'

export class NoHolesInArrays implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.ArrayExpression) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `No holes are allowed in array literals.`
  }

  public elaborate() {
    return stripIndent`
      No holes (empty slots with no content inside) are allowed in array literals.
      You probably have an extra comma, which creates a hole.
    `
  }
}

const noHolesInArrays: Rule<es.ArrayExpression> = {
  name: 'no-holes-in-arrays',

  checkers: {
    ArrayExpression(node: es.ArrayExpression) {
      return node.elements.some(x => x === null) ? [new NoHolesInArrays(node)] : []
    }
  }
}

export default noHolesInArrays
