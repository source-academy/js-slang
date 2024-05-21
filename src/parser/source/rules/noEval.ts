import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Node, SourceError } from '../../../types'
import { Rule } from '../../types'

export class NoEval implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.Identifier) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `eval is not allowed.`
  }

  public elaborate() {
    return this.explain()
  }
}

const noEval: Rule<es.Identifier> = {
  name: 'no-eval',
  testSnippets: [
    ['eval("0;");', 'Line 1: eval is not allowed.']
  ],

  checkers: {
    Identifier(node: es.Identifier, _ancestors: [Node]) {
      if (node.name === 'eval') {
        return [new NoEval(node)]
      } else {
        return []
      }
    }
  }
}

export default noEval
