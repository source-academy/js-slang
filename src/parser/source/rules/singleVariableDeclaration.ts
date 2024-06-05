import { generate } from 'astring'
import type { Identifier, VariableDeclaration, VariableDeclarator } from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { RuleError, type Rule } from '../../types'
import { stripIndent } from '../../../utils/formatters'
import { mapAndFilter } from '../../../utils/misc'

export class NoImplicitDeclareUndefinedError extends RuleError<VariableDeclarator> {
  private readonly name: string

  constructor(node: VariableDeclarator) {
    super(node)
    this.name = (node.id as Identifier).name
  }

  public explain() {
    return 'Missing value in variable declaration.'
  }

  public elaborate() {
    return stripIndent`
      A variable declaration assigns a value to a name.
      For instance, to assign 20 to ${this.name}, you can write:

        let ${this.name} = 20;

        ${this.name} + ${this.name}; // 40
    `
  }
}

export class MultipleDeclarationsError extends RuleError<VariableDeclaration> {
  private fixs: VariableDeclaration[]

  constructor(node: VariableDeclaration) {
    super(node)

    this.fixs = node.declarations.map(declaration => ({
      type: 'VariableDeclaration' as const,
      kind: 'let' as const,
      loc: declaration.loc,
      declarations: [declaration]
    }))
  }

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Multiple declarations in a single statement.'
  }

  public elaborate() {
    const fixs = this.fixs.map(n => '\t' + generate(n)).join('\n')
    return 'Split the variable declaration into multiple lines as follows\n\n' + fixs + '\n'
  }
}

const singleVariableDeclaration: Rule<VariableDeclaration> = {
  name: 'single-variable-declaration',
  testSnippets: [
    ['let i = 0, j = 0;', 'Line 1: Multiple declarations in a single statement.'],
    ['let i;', 'Line 1: Missing value in variable declaration.']
  ],

  checkers: {
    VariableDeclaration(node, ancestors) {
      if (node.declarations.length > 1) {
        return [new MultipleDeclarationsError(node)]
      }

      const ancestor = ancestors[ancestors.length - 2]
      if (ancestor.type === 'ForOfStatement' || ancestor.type === 'ForInStatement') {
        return []
      }

      return mapAndFilter(node.declarations, decl =>
        decl.init ? undefined : new NoImplicitDeclareUndefinedError(decl)
      )
    }
  }
}

export default singleVariableDeclaration
