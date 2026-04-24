import { Variant } from '../../../langs';
import { defineRule } from '../../types';
import { NoUnspecifiedOperatorError } from './noUnspecifiedOperator';

export default defineRule(
  'no-typeof-operator',
  {
    UnaryExpression(node) {
      if (node.operator === 'typeof') {
        return [new NoUnspecifiedOperatorError(node)];
      } else {
        return [];
      }
    },
  },
  undefined,
  [Variant.TYPED],
);
