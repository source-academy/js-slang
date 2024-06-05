import { generate } from 'astring'
import type { VariableDeclaration } from 'estree'

import { RuleError, type Rule } from '../../types'
import { getDeclaratorFromSingleDeclaration } from '../../../utils/ast/helpers'

export class NoVarError extends RuleError<VariableDeclaration> {
  public explain() {
    return 'Variable declaration using "var" is not allowed.'
  }

  public elaborate() {
    const { id, init } = getDeclaratorFromSingleDeclaration(this.node)
    const name = id.name
    const value = generate(init)

    return `Use keyword "let" instead, to declare a variable:\n\n\tlet ${name} = ${value};`
  }
}

const noVar: Rule<VariableDeclaration> = {
  name: 'no-var',
  testSnippets: [['var x = 0;', 'Line 1: Variable declaration using "var" is not allowed.']],
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
