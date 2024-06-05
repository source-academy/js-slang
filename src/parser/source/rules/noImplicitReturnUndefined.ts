import type { ReturnStatement } from 'estree'
import { Rule, RuleError } from '../../types'
import { stripIndent } from '../../../utils/formatters'

export class NoImplicitReturnUndefinedError extends RuleError<ReturnStatement> {
  public explain() {
    return 'Missing value in return statement.'
  }

  public elaborate() {
    return stripIndent`
      This return statement is missing a value.
      For instance, to return the value 42, you can write

        return 42;
    `
  }
}

const noImplicitReturnUndefined: Rule<ReturnStatement> = {
  name: 'no-implicit-return-undefined',
  testSnippets: [['function f() { return; }', 'Line 1: Missing value in return statement.']],

  checkers: {
    ReturnStatement(node) {
      if (!node.argument) {
        return [new NoImplicitReturnUndefinedError(node)]
      } else {
        return []
      }
    }
  }
}

export default noImplicitReturnUndefined
