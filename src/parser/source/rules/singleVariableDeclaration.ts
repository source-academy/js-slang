import { generate } from 'astring'
import type { VariableDeclaration } from 'estree'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

export class MultipleDeclarationsError extends RuleError<VariableDeclaration> {
  private readonly fixs: VariableDeclaration[]

  constructor(node: VariableDeclaration) {
    super(node)
    this.fixs = node.declarations.map(declaration => ({
      type: 'VariableDeclaration',
      kind: node.kind,
      loc: declaration.loc,
      declarations: [declaration]
    }))
  }

  public explain() {
    return 'Multiple declarations in a single statement.'
  }

  public elaborate() {
    const fixs = this.fixs.map(n => '  ' + generate(n)).join('\n')
    return 'Split the variable declaration into multiple lines as follows\n\n' + fixs + '\n'
  }
}

const singleVariableDeclaration: Rule<VariableDeclaration> = {
  name: 'single-variable-declaration',

  checkers: {
    VariableDeclaration(node) {
      if (node.declarations.length > 1) {
        return [new MultipleDeclarationsError(node)]
      } else {
        return []
      }
    }
  }
}

export default singleVariableDeclaration
