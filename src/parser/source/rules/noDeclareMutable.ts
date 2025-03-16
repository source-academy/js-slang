import { generate } from 'astring'
import type { VariableDeclaration } from 'estree'
import type { Rule } from '../../types'
import { RuleError } from '../../errors'
import { Chapter } from '../../../types'
import { getSourceVariableDeclaration } from '../../../utils/ast/helpers'

const mutableDeclarators: VariableDeclaration['kind'][] = ['let', 'var']

export class NoDeclareMutableError extends RuleError<VariableDeclaration> {
  public explain() {
    return `Mutable variable declaration using keyword '${this.node.kind}' is not allowed.`
  }

  public elaborate() {
    const {
      id: { name },
      init
    } = getSourceVariableDeclaration(this.node)
    const value = generate(init)

    return `Use keyword "const" instead, to declare a constant:\n\n\tconst ${name} = ${value};`
  }
}

const noDeclareMutable: Rule<VariableDeclaration> = {
  name: 'no-declare-mutable',
  disableFromChapter: Chapter.SOURCE_3,

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
