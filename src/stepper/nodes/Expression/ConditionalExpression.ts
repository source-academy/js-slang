import type { Comment, ConditionalExpression, SourceLocation } from 'estree';
import type { StepperExpression, StepperPattern } from '..';
import { convert } from '../../generator';
import { StepperBaseNode } from '../../interface';
import { checkIfStatement } from '../../../utils/rttc';
import type { RedexInfo } from '../..';
import { InternalRuntimeError } from '../../../errors/base';

export class StepperConditionalExpression
  extends StepperBaseNode<ConditionalExpression>
  implements ConditionalExpression
{
  constructor(
    public readonly test: StepperExpression,
    public readonly consequent: StepperExpression,
    public readonly alternate: StepperExpression,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number],
  ) {
    super('ConditionalExpression', leadingComments, trailingComments, loc, range);
  }

  static create(node: ConditionalExpression) {
    return new StepperConditionalExpression(
      convert(node.test),
      convert(node.consequent),
      convert(node.alternate),
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range,
    );
  }

  public override isContractible(redex: RedexInfo): boolean {
    if (this.test.type !== 'Literal') return false;
    const test_value = this.test.value;
    checkIfStatement(this, test_value);

    redex.preRedex = [this];
    return true;
  }

  public override isOneStepPossible(redex: RedexInfo): boolean {
    return this.isContractible(redex) || this.test.isOneStepPossible(redex);
  }

  public override contract(redex: RedexInfo): StepperExpression {
    redex.preRedex = [this];
    if (this.test.type !== 'Literal' || typeof this.test.value !== 'boolean') {
      throw new InternalRuntimeError(
        'Cannot contract ConditionalExpression with non-boolean literal test',
        this,
      );
    }

    const result = this.test.value ? this.consequent : this.alternate;
    redex.postRedex = [result];
    return result;
  }

  public override oneStep(redex: RedexInfo): StepperExpression {
    if (this.isContractible(redex)) {
      return this.contract(redex);
    }

    return new StepperConditionalExpression(
      this.test.oneStep(redex),
      this.consequent,
      this.alternate,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range,
    );
  }

  public override substitute(
    id: StepperPattern,
    value: StepperExpression,
    redex: RedexInfo,
  ): StepperExpression {
    return new StepperConditionalExpression(
      this.test.substitute(id, value, redex),
      this.consequent.substitute(id, value, redex),
      this.alternate.substitute(id, value, redex),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range,
    );
  }

  public override freeNames(): string[] {
    return Array.from(
      new Set([
        ...this.test.freeNames(),
        ...this.consequent.freeNames(),
        ...this.alternate.freeNames(),
      ]),
    );
  }

  public override allNames(): string[] {
    return Array.from(
      new Set([
        ...this.test.allNames(),
        ...this.consequent.allNames(),
        ...this.alternate.allNames(),
      ]),
    );
  }

  public override rename(before: string, after: string): StepperExpression {
    return new StepperConditionalExpression(
      this.test.rename(before, after),
      this.consequent.rename(before, after),
      this.alternate.rename(before, after),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range,
    );
  }
}
