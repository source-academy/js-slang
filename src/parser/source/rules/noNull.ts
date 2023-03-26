import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { Chapter, ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'

export class NoNullError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.Literal) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `null literals are not allowed.`
  }

  public elaborate() {
    return "They're not part of the Source §1 specs."
  }
}

const noNull: Rule<es.Literal> = {
  name: 'no-null',
  disableFromChapter: Chapter.SOURCE_2,
  checkers: {
    Literal(node: es.Literal, _ancestors: [es.Node]) {
      if (node.value === null) {
        return [new NoNullError(node)]
      } else {
        return []
      }
    }
  }
}

export default noNull
