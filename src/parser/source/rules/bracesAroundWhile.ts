import { generate } from 'astring';
import type { WhileStatement } from 'estree';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

export class BracesAroundWhileError extends RuleError<WhileStatement> {
  public explain() {
    return 'Missing curly braces around "while" block.';
  }

  public elaborate() {
    const testStr = generate(this.node.test);
    const whileStr = `\twhile (${testStr}) {\n\t\t//code goes here\n\t}`;

    return `Remember to enclose your "while" block with braces:\n\n ${whileStr}`;
  }
}

export default defineRule('braces-around-while', {
  WhileStatement(node) {
    if (node.body.type !== 'BlockStatement') {
      return [new BracesAroundWhileError(node)];
    } else {
      return [];
    }
  },
});
