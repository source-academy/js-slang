import type es from 'estree'

import { Variant } from '../../../types'
import type { Rule } from '../../types'
import { NoUnspecifiedOperatorError } from './noUnspecifiedOperator'

const noTypeofOperator: Rule<es.UnaryExpression> = {
  name: 'no-typeof-operator',
  disableForVariants: [Variant.TYPED],

  testSnippets: [['typeof "string";', "Line 1: Operator 'typeof' is not allowed."]],

  checkers: {
    UnaryExpression(node) {
      if (node.operator === 'typeof') {
        return [new NoUnspecifiedOperatorError(node)]
      } else {
        return []
      }
    }
  }
}

export default noTypeofOperator
