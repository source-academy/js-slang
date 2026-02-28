import type { ReturnStatement } from 'estree'
import { stripIndent } from '../../../utils/formatters'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

export class NoImplicitReturnUndefinedError extends RuleError<ReturnStatement> {
  public override explain() {
    return 'Missing value in return statement.'
  }

  public override elaborate() {
    return stripIndent`
      This return statement is missing a value.
      For instance, to return the value 42, you can write

        return 42;
    `
  }
}

const noImplicitReturnUndefined: Rule<ReturnStatement> = {
  name: 'no-implicit-return-undefined',

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
