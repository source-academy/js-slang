import type { Literal } from 'estree'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'
import { Chapter } from '../../../types'

export class NoNullError extends RuleError<Literal> {
  public explain() {
    return `null literals are not allowed.`
  }

  public elaborate() {
    return "They're not part of the Source §1 specs."
  }
}

const noNull: Rule<Literal> = {
  name: 'no-null',
  disableFromChapter: Chapter.SOURCE_2,
  checkers: {
    Literal(node) {
      if (node.value === null) {
        return [new NoNullError(node)]
      } else {
        return []
      }
    }
  }
}

export default noNull
