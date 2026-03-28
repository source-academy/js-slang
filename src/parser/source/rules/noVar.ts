import { generate } from 'astring'
import type { VariableDeclaration } from 'estree'
import { getSourceVariableDeclaration } from '../../../utils/ast/helpers'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

export class NoVarError extends RuleError<VariableDeclaration> {
  public override explain() {
    return 'Variable declaration using "var" is not allowed.'
  }

  public override elaborate() {
    const {
      id: { name },
      init
    } = getSourceVariableDeclaration(this.node)
    const value = generate(init)

    return `Use keyword "let" instead, to declare a variable:\n\n\tlet ${name} = ${value};`
  }
}

const noVar: Rule<VariableDeclaration> = {
  name: 'no-var',

  checkers: {
    VariableDeclaration(node) {
      if (node.kind === 'var') {
        return [new NoVarError(node)]
      } else {
        return []
      }
    }
  }
}

export default noVar
