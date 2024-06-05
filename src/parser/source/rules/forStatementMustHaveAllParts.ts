import { ForStatement } from 'estree'
import { RuleError, type Rule } from '../../types'
import { stripIndent } from '../../../utils/formatters'

const parts = ['init', 'test', 'update'] as const

export class ForStatmentMustHaveAllParts extends RuleError<ForStatement> {
  constructor(node: ForStatement, private missingParts: string[]) {
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

  testSnippets: [
    ['let i = 0; for (; i < 0; i = i + 1) {}', 'Line 1: Missing init expression in for statement.'],
    ['for (let i = 0; ; i = i + 1) {}', 'Line 1: Missing test expression in for statement.'],
    ['for (let i = 0; i < 0;) {}', 'Line 1: Missing update expression in for statement']
  ],

  checkers: {
    ForStatement(node) {
      const missingParts = parts.filter(part => node[part] === null)
      if (missingParts.length > 0) {
        return [new ForStatmentMustHaveAllParts(node, missingParts)]
      } else {
        return []
      }
    }
  }
}

export default forStatementMustHaveAllParts
