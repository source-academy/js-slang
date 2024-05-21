import type * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, type SourceError } from '../../../types'
import type { Rule } from '../../types'
import { stripIndent } from '../../../utils/formatters'

export class ForStatmentMustHaveAllParts implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.ForStatement, private missingParts: string[]) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
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

const forStatementMustHaveAllParts: Rule<es.ForStatement> = {
  name: 'for-statement-must-have-all-parts',

  testSnippets: [
    ['let i = 0; for (; i < 0; i = i + 1) {}', 'Line 1: Missing init expression in for statement.'],
    ['for (let i = 0; ; i = i + 1) {}', 'Line 1: Missing test expression in for statement.'],
    ['for (let i = 0; i < 0;) {}', 'Line 1: Missing update expression in for statement']
  ],

  checkers: {
    ForStatement(node) {
      const missingParts = ['init', 'test', 'update'].filter(part => node[part] === null)
      if (missingParts.length > 0) {
        return [new ForStatmentMustHaveAllParts(node, missingParts)]
      } else {
        return []
      }
    }
  }
}

export default forStatementMustHaveAllParts
