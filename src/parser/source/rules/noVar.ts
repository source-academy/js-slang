import type { VariableDeclaration } from 'estree'
import { generate } from 'astring'
import type { Rule } from '../../types'
import { RuleError } from '../../errors'
import { getVariableDeclarationName } from '../../../utils/ast/astCreator'

export class NoVarError extends RuleError<VariableDeclaration> {
  public explain() {
    return 'Variable declaration using "var" is not allowed.'
  }

  public elaborate() {
    const name = getVariableDeclarationName(this.node)
    const value = generate(this.node.declarations[0].init)

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
