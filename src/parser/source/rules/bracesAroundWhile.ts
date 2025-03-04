import { generate } from 'astring'
import type { WhileStatement } from 'estree'
import { type Rule, RuleError } from '../../types'

export class BracesAroundWhileError extends RuleError<WhileStatement> {
  public explain() {
    return 'Missing curly braces around "while" block.'
  }

  public elaborate() {
    const testStr = generate(this.node.test)
    const whileStr = `\twhile (${testStr}) {\n\t\t//code goes here\n\t}`

    return `Remember to enclose your "while" block with braces:\n\n ${whileStr}`
  }
}

const bracesAroundWhile: Rule<WhileStatement> = {
  name: 'braces-around-while',
  testSnippets: [
    [
      `
        let i = 0;
        while (true) i = i + 1;
      `,
      'Line 3: Missing curly braces around "while" block.'
    ]
  ],
  checkers: {
    WhileStatement(node: WhileStatement) {
      if (node.body.type !== 'BlockStatement') {
        return [new BracesAroundWhileError(node)]
      } else {
        return []
      }
    }
  }
}

export default bracesAroundWhile
