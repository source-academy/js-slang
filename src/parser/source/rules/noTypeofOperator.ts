import * as es from 'estree'

import { Variant } from '../../../types'
import { Rule } from '.'
import { NoUnspecifiedOperatorError } from './noUnspecifiedOperator'

const noTypeofOperator: Rule<es.UnaryExpression> = {
  name: 'no-typeof-operator',
  disableForVariants: [Variant.TYPED],

  checkers: {
    UnaryExpression(node: es.UnaryExpression) {
      if (node.operator === 'typeof') {
        return [new NoUnspecifiedOperatorError(node)]
      } else {
        return []
      }
    }
  }
}

export default noTypeofOperator
