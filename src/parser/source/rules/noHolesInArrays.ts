import type { ArrayExpression } from 'estree'
import { stripIndent } from '../../../utils/formatters'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

export class NoHolesInArrays extends RuleError<ArrayExpression> {
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

const noHolesInArrays: Rule<ArrayExpression> = {
  name: 'no-holes-in-arrays',

  checkers: {
    ArrayExpression(node) {
      return node.elements.some(x => x === null) ? [new NoHolesInArrays(node)] : []
    }
  }
}

export default noHolesInArrays
