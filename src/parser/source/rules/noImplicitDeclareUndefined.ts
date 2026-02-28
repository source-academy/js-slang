import type { Identifier, VariableDeclaration } from 'estree'
import { stripIndent } from '../../../utils/formatters'
import { mapAndFilter } from '../../../utils/misc'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

export class NoImplicitDeclareUndefinedError extends RuleError<Identifier> {
  public override explain() {
    return 'Missing value in variable declaration.'
  }

  public override elaborate() {
    return stripIndent`
      A variable declaration assigns a value to a name.
      For instance, to assign 20 to ${this.node.name}, you can write:

        let ${this.node.name} = 20;

        ${this.node.name} + ${this.node.name}; // 40
    `
  }
}

const noImplicitDeclareUndefined: Rule<VariableDeclaration> = {
  name: 'no-implicit-declare-undefined',

  checkers: {
    VariableDeclaration(node, ancestors) {
      if (ancestors.length > 1) {
        switch (ancestors[ancestors.length - 2].type) {
          case 'ForOfStatement':
          case 'ForInStatement':
            return []
        }
      }

      return mapAndFilter(node.declarations, decl =>
        decl.init ? undefined : new NoImplicitDeclareUndefinedError(decl.id as Identifier)
      )
    }
  }
}

export default noImplicitDeclareUndefined
