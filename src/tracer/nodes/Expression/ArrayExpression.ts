import type { ArrayExpression, Comment, Expression, SourceLocation } from 'estree';
import type { StepperExpression, StepperPattern } from '..';
import { convert } from '../../generator';
import { StepperBaseNode } from '../../interface';
import type { RedexInfo } from '../..';
import { InternalRuntimeError } from '../../../errors/runtimeErrors';

export class StepperArrayExpression
  extends StepperBaseNode<ArrayExpression>
  implements ArrayExpression
{
  constructor(
    public readonly elements: (StepperExpression | null)[],
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number],
  ) {
    super('ArrayExpression', leadingComments, trailingComments, loc, range);
  }

  static create(node: ArrayExpression) {
    return new StepperArrayExpression(
      node.elements.map(element => (element ? convert(element as Expression) : null)),
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range,
    );
  }

  public override isContractible(): boolean {
    return false;
  }

  public override isOneStepPossible(redex: RedexInfo): boolean {
    return this.elements.some(element => element?.isOneStepPossible(redex));
  }

  public override contract(redex: RedexInfo): StepperExpression {
    redex.preRedex = [this];
    throw new InternalRuntimeError('Array expressions cannot be contracted', this);
  }

  public override oneStep(redex: RedexInfo): StepperExpression {
    if (this.isContractible()) {
      return this.contract(redex);
    }

    for (let i = 0; i < this.elements.length; i++) {
      const element = this.elements[i];
      if (element?.isOneStepPossible(redex)) {
        const newElements = [...this.elements];
        newElements[i] = element.oneStep(redex);
        return new StepperArrayExpression(
          newElements,
          this.leadingComments,
          this.trailingComments,
          this.loc,
          this.range,
        );
      }
    }

    throw new InternalRuntimeError('No one step possible for ArrayExpression', this);
  }

  public override substitute(
    id: StepperPattern,
    value: StepperExpression,
    redex: RedexInfo,
  ): StepperExpression {
    return new StepperArrayExpression(
      this.elements.map(element => (element ? element.substitute(id, value, redex) : null)),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range,
    );
  }

  public override freeNames(): string[] {
    const names = this.elements
      .filter(element => element !== null)
      .flatMap(element => element.freeNames());
    return Array.from(new Set(names));
  }

  public override allNames(): string[] {
    const names = this.elements
      .filter(element => element !== null)
      .flatMap(element => element.allNames());
    return Array.from(new Set(names));
  }

  public override rename(before: string, after: string): StepperExpression {
    return new StepperArrayExpression(
      this.elements.map(element => (element ? element.rename(before, after) : null)),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range,
    );
  }
}
