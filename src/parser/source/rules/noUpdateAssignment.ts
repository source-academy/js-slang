import { generate } from 'astring';
import type { AssignmentExpression } from 'estree';
import { defineRule } from '../../types';
import { NoUnspecifiedOperatorError } from './noUnspecifiedOperator';

export class NoUpdateAssignment extends NoUnspecifiedOperatorError<AssignmentExpression> {
  public override explain() {
    return `The assignment operator ${this.node.operator} is not allowed. Use = instead.`;
  }

  public override elaborate() {
    const leftStr = generate(this.node.left);
    const rightStr = generate(this.node.right);
    const newOpStr = this.node.operator.slice(0, -1);

    if (newOpStr === '+' || newOpStr === '-' || newOpStr === '/' || newOpStr === '*') {
      const elabStr = `\n\t${leftStr} = ${leftStr} ${newOpStr} ${rightStr};`;

      return elabStr;
    } else {
      return '';
    }
  }
}

export default defineRule('no-update-assignment', {
  AssignmentExpression(node) {
    if (node.operator !== '=') {
      return [new NoUpdateAssignment(node)];
    } else {
      return [];
    }
  },
});
