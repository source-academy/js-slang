import type { UnaryExpression } from 'estree'
import { Variant } from '../../../types'
import type { Rule } from '../../types'
import { NoUnspecifiedOperatorError } from './noUnspecifiedOperator'

const noTypeofOperator: Rule<UnaryExpression> = {
  name: 'no-typeof-operator',
  disableForVariants: [Variant.TYPED],

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
