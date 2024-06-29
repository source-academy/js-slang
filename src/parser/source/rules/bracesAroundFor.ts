import type { ForStatement } from 'estree'
import { generate } from 'astring'

import { RuleError, type Rule } from '../../types'

const errorMsg = 'Missing curly braces around "for" block.'

export class BracesAroundForError extends RuleError<ForStatement> {
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

const bracesAroundFor: Rule<ForStatement> = {
  name: 'braces-around-for',
  testSnippets: [
    [
      `
        let j = 0;
        for (let i = 0; i < 1; i = i + 1) j = j + 1;
      `,
      errorMsg
    ]
  ],
  checkers: {
    ForStatement(node) {
      if (node.body.type !== 'BlockStatement') {
        return [new BracesAroundForError(node)]
      } else {
        return []
      }
    }
  }
}

export default bracesAroundFor
