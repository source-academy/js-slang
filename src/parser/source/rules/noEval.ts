import type { Identifier } from 'estree'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

export class NoEval extends RuleError<Identifier> {
  public override explain() {
    return `eval is not allowed.`
  }

  public override elaborate() {
    return this.explain()
  }
}

const noEval: Rule<Identifier> = {
  name: 'no-eval',

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
