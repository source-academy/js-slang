import type { SpreadElement } from 'estree'
import { RuleError, type Rule } from '../../types'

export class NoSpreadInArray extends RuleError<SpreadElement> {
  public explain() {
    return 'Spread syntax is not allowed in arrays.'
  }

  public elaborate() {
    return ''
  }
}

const noSpreadInArray = {
  name: 'no-assignment-expression',
  testSnippets: [
    ['const a = [...b];', 'Line 1: Spread syntax is not allowed in arrays.'],
    ['display(...args);', undefined]
  ],
  checkers: {
    SpreadElement(node, ancestors) {
      const parent = ancestors[ancestors.length - 2]

      if (parent.type === 'CallExpression') {
        return []
      } else {
        return [new NoSpreadInArray(node)]
      }
    }
  }
} satisfies Rule<SpreadElement>

export default noSpreadInArray
