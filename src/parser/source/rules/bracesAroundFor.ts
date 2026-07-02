import { generate } from 'astring';
import type { ForStatement } from 'estree';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

export class BracesAroundForError extends RuleError<ForStatement> {
  public override explain() {
    return 'Missing curly braces around "for" block.';
  }

  public override elaborate() {
    const initStr = generate(this.node.init);
    const testStr = generate(this.node.test);
    const updateStr = generate(this.node.update);

    const forStr = `\tfor (${initStr} ${testStr}; ${updateStr}) {\n\t\t//code goes here\n\t}`;

    return `Remember to enclose your "for" block with braces:\n\n ${forStr}`;
  }
}

export default defineRule('braces-around-for', {
  ForStatement(node) {
    if (node.body.type !== 'BlockStatement') {
      return [new BracesAroundForError(node)];
    } else {
      return [];
    }
  },
});
