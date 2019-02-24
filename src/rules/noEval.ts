import * as es from 'estree'

import { ErrorSeverity, ErrorType, Rule, SourceError } from '../types'

export class NoEval implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.Identifier) {}

  get location() {
    return this.node.loc!
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

  checkers: {
    Identifier(node: es.Identifier, ancestors: [es.Node]) {
      if (node.name === 'eval') {
        return [new NoEval(node)]
      } else {
        return []
      }
    }
  }
}

export default noEval
