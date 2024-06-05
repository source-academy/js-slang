import { generate } from 'astring'

import type { VariableDeclaration } from 'estree'
import { Chapter } from '../../../types'
import { RuleError, type Rule } from '../../types'
import { getDeclaratorFromSingleDeclaration } from '../../../utils/ast/helpers'

const mutableDeclarators = ['let', 'var']

export class NoDeclareMutableError extends RuleError<VariableDeclaration> {
  public explain() {
    return `Mutable variable declaration using keyword '${this.node.kind}' is not allowed.`
  }

  public elaborate() {
    const { id, init } = getDeclaratorFromSingleDeclaration(this.node)
    const name = id.name
    const value = generate(init)

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
    VariableDeclaration(node) {
      if (mutableDeclarators.includes(node.kind)) {
        return [new NoDeclareMutableError(node)]
      } else {
        return []
      }
    }
  }
}

export default noDeclareMutable
