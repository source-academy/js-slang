import { generate } from 'astring';
import type { VariableDeclaration } from 'estree';
import { Chapter } from '../../../langs';
import { getSourceVariableDeclaration } from '../../../utils/ast/helpers';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

const mutableDeclarators: VariableDeclaration['kind'][] = ['let', 'var'];

export class NoDeclareMutableError extends RuleError<VariableDeclaration> {
  public override explain() {
    return `Mutable variable declaration using keyword '${this.node.kind}' is not allowed.`;
  }

  public override elaborate() {
    const {
      id: { name },
      init,
    } = getSourceVariableDeclaration(this.node);
    const value = generate(init);

    return `Use keyword "const" instead, to declare a constant:\n\n\tconst ${name} = ${value};`;
  }
}

export default defineRule(
  'no-declare-mutable',
  {
    VariableDeclaration(node) {
      if (mutableDeclarators.includes(node.kind)) {
        return [new NoDeclareMutableError(node)];
      } else {
        return [];
      }
    },
  },
  Chapter.SOURCE_3,
);
