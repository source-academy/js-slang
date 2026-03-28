import { generate } from 'astring'
import type { IfStatement } from 'estree'
import { stripIndent } from '../../../utils/formatters'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

export class BracesAroundIfElseError extends RuleError<IfStatement> {
  constructor(
    node: IfStatement,
    private readonly branch: 'consequent' | 'alternate'
  ) {
    super(node)
  }

  public override explain() {
    if (this.branch === 'consequent') {
      return 'Missing curly braces around "if" block.'
    } else {
      return 'Missing curly braces around "else" block.'
    }
  }

  public override elaborate() {
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

  checkers: {
    IfStatement(node) {
      const errors: BracesAroundIfElseError[] = []
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
