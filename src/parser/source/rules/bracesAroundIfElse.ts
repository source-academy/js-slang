import { generate } from 'astring'
import type { IfStatement } from 'estree'
import type { SourceError } from '../../../types'
import { type Rule, RuleError } from '../../types'
import { stripIndent } from '../../../utils/formatters'

export class BracesAroundIfElseError extends RuleError<IfStatement> {
  constructor(public node: IfStatement, private branch: 'consequent' | 'alternate') {
    super(node)
  }

  public explain() {
    if (this.branch === 'consequent') {
      return 'Missing curly braces around "if" block.'
    } else {
      return 'Missing curly braces around "else" block.'
    }
  }

  public elaborate() {
    let ifOrElse
    let header
    let body
    if (this.branch === 'consequent') {
      ifOrElse = 'if'
      header = `if (${generate(this.node.test)})`
      body = this.node.consequent
    } else {
      ifOrElse = header = 'else'
      body = this.node.alternate
    }

    return stripIndent`
      ${ifOrElse} block need to be enclosed with a pair of curly braces.

      ${header} {
        ${generate(body)}
      }

      An exception is when you have an "if" followed by "else if", in this case
      "else if" block does not need to be surrounded by curly braces.

      if (someCondition) {
        // ...
      } else /* notice missing { here */ if (someCondition) {
        // ...
      } else {
        // ...
      }

      Rationale: Readability in dense packed code.

      In the snippet below, for instance, with poor indentation it is easy to
      mistaken hello() and world() to belong to the same branch of logic.

      if (someCondition) {
        2;
      } else
        hello();
      world();

    `
  }
}

const bracesAroundIfElse: Rule<IfStatement> = {
  name: 'braces-around-if-else',
  testSnippets: [
    [
      `
        function f() {
          if (true) return false;
          else return true;
        }
      `,
      'Line 3: Missing curly braces around "if" block.'
    ]
  ],
  checkers: {
    IfStatement(node: IfStatement) {
      const errors: SourceError[] = []
      if (node.consequent && node.consequent.type !== 'BlockStatement') {
        errors.push(new BracesAroundIfElseError(node, 'consequent'))
      }
      if (node.alternate) {
        const notBlock = node.alternate.type !== 'BlockStatement'
        const notIf = node.alternate.type !== 'IfStatement'
        if (notBlock && notIf) {
          errors.push(new BracesAroundIfElseError(node, 'alternate'))
        }
      }
      return errors
    }
  }
}

export default bracesAroundIfElse
