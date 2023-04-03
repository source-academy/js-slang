import { generate } from 'astring'
import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'

export class BracesAroundWhileError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.WhileStatement) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Missing curly braces around "while" block.'
  }

  public elaborate() {
    const testStr = generate(this.node.test)
    const whileStr = `\twhile (${testStr}) {\n\t\t//code goes here\n\t}`

    return `Remember to enclose your "while" block with braces:\n\n ${whileStr}`
  }
}

const bracesAroundWhile: Rule<es.WhileStatement> = {
  name: 'braces-around-while',

  checkers: {
    WhileStatement(node: es.WhileStatement, _ancestors: [es.Node]) {
      if (node.body.type !== 'BlockStatement') {
        return [new BracesAroundWhileError(node)]
      } else {
        return []
      }
    }
  }
}

export default bracesAroundWhile
