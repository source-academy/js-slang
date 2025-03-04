import { generate } from 'astring'
import type { VariableDeclaration } from 'estree'
import { Chapter } from '../../../types'
import { type Rule, RuleError } from '../../types'
import { getVariableDeclarationName } from '../../../utils/ast/astCreator'

const mutableDeclarators = ['let', 'var']

export class NoDeclareMutableError extends RuleError<VariableDeclaration> {
  public explain() {
    return (
      'Mutable variable declaration using keyword ' + `'${this.node.kind}'` + ' is not allowed.'
    )
  }

  public elaborate() {
    const name = getVariableDeclarationName(this.node)
    const value = generate(this.node.declarations[0].init)

    return `Use keyword "const" instead, to declare a constant:\n\n\tconst ${name} = ${value};`
  }
}

const noDeclareMutable: Rule<VariableDeclaration> = {
  name: 'no-declare-mutable',
  disableFromChapter: Chapter.SOURCE_3,
  testSnippets: [
    ['let i = 0;', "Line 1: Mutable variable declaration using keyword 'let' is not allowed."]
  ],
  checkers: {
    VariableDeclaration(node: VariableDeclaration) {
      if (mutableDeclarators.includes(node.kind)) {
        return [new NoDeclareMutableError(node)]
      } else {
        return []
      }
    }
  }
}

export default noDeclareMutable
