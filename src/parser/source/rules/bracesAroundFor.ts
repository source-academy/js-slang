import { generate } from 'astring'
import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'

export class BracesAroundForError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.ForStatement) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Missing curly braces around "for" block.'
  }

  public elaborate() {
    const initStr = generate(this.node.init)
    const testStr = generate(this.node.test)
    const updateStr = generate(this.node.update)

    const forStr = `\tfor (${initStr} ${testStr}; ${updateStr}) {\n\t\t//code goes here\n\t}`

    return `Remember to enclose your "for" block with braces:\n\n ${forStr}`
  }
}

const bracesAroundFor: Rule<es.ForStatement> = {
  name: 'braces-around-for',

  checkers: {
    ForStatement(node: es.ForStatement, _ancestors: [es.Node]) {
      if (node.body.type !== 'BlockStatement') {
        return [new BracesAroundForError(node)]
      } else {
        return []
      }
    }
  }
}

export default bracesAroundFor
