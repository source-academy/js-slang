import type { Literal } from 'estree'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

const specifiedLiterals = ['boolean', 'string', 'number']

export class NoUnspecifiedLiteral extends RuleError<Literal> {
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

const noUnspecifiedLiteral: Rule<Literal> = {
  name: 'no-unspecified-literal',
  checkers: {
    Literal(node) {
      if (node.value !== null && !specifiedLiterals.includes(typeof node.value)) {
        return [new NoUnspecifiedLiteral(node)]
      } else {
        return []
      }
    }
  }
}

export default noUnspecifiedLiteral
