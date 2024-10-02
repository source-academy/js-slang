import type { Identifier } from 'estree'
import { RuleError, type Rule } from '../../types'

export class NoEval extends RuleError<Identifier> {
  public explain() {
    return `eval is not allowed.`
  }

  public elaborate() {
    return this.explain()
  }
}

const noEval: Rule<Identifier> = {
  name: 'no-eval',
  testSnippets: [['eval("0;");', 'Line 1: eval is not allowed.']],

  checkers: {
    Identifier(node) {
      if (node.name === 'eval') {
        return [new NoEval(node)]
      } else {
        return []
      }
    }
  }
}

export default noEval
