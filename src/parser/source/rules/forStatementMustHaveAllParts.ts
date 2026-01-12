import type { ForStatement } from 'estree'
import { stripIndent } from '../../../utils/formatters'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

type ForStatementParts = keyof ForStatement
const forStatementParts: ForStatementParts[] = ['init', 'test', 'update']

export class ForStatmentMustHaveAllParts extends RuleError<ForStatement> {
  constructor(
    node: ForStatement,
    private readonly missingParts: ForStatementParts[]
  ) {
    super(node)
  }

  public explain() {
    return `Missing ${this.missingParts.join(', ')} expression${
      this.missingParts.length === 1 ? '' : 's'
    } in for statement.`
  }

  public elaborate() {
    return stripIndent`
      This for statement requires all three parts (initialiser, test, update) to be present.
    `
  }
}

const forStatementMustHaveAllParts: Rule<ForStatement> = {
  name: 'for-statement-must-have-all-parts',

  checkers: {
    ForStatement(node) {
      const missingParts = forStatementParts.filter(part => node[part] === null)
      if (missingParts.length > 0) {
        return [new ForStatmentMustHaveAllParts(node, missingParts)]
      } else {
        return []
      }
    }
  }
}

export default forStatementMustHaveAllParts
