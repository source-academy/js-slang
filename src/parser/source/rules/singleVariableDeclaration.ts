import { generate } from 'astring'
import type es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, type Node, type SourceError } from '../../../types'
import type { Rule } from '../../types'
import { stripIndent } from '../../../utils/formatters'

export class NoImplicitDeclareUndefinedError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.Identifier) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Missing value in variable declaration.'
  }

  public elaborate() {
    return stripIndent`
      A variable declaration assigns a value to a name.
      For instance, to assign 20 to ${this.node.name}, you can write:

        let ${this.node.name} = 20;

        ${this.node.name} + ${this.node.name}; // 40
    `
  }
}

export class MultipleDeclarationsError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR
  private fixs: es.VariableDeclaration[]

  constructor(public node: es.VariableDeclaration) {
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

const singleVariableDeclaration: Rule<es.VariableDeclaration> = {
  name: 'single-variable-declaration',
  testSnippets: [
    ['let i = 0, j = 0;', 'Line 1: Multiple declarations in a single statement.'],
    ['let i;', 'Line 1: Missing value in variable declaration.']
  ],

  checkers: {
    VariableDeclaration(node: es.VariableDeclaration, ancestors: Node[]) {
      if (node.declarations.length > 1) {
        return [new MultipleDeclarationsError(node)]
      }

      const ancestor = ancestors[ancestors.length - 2]
      if (ancestor.type === 'ForOfStatement' || ancestor.type === 'ForInStatement') {
        return []
      }

      const errors: SourceError[] = []
      for (const decl of node.declarations) {
        if (!decl.init) {
          errors.push(new NoImplicitDeclareUndefinedError(decl.id as es.Identifier))
        }
      }
      return errors
    }
  }
}

export default singleVariableDeclaration
