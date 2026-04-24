import type { Comment, Identifier, SourceLocation } from 'estree';
import type { StepperExpression, StepperPattern } from '..';
import { isBuiltinFunction } from '../../builtins';
import { StepperBaseNode } from '../../interface';
import { UnassignedVariableError } from '../../../errors/errors';
import type { RedexInfo } from '../..';
import { InternalRuntimeError } from '../../../errors/base';

export class StepperIdentifier extends StepperBaseNode<Identifier> implements Identifier {
  constructor(
    public readonly name: string,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number],
  ) {
    super('Identifier', leadingComments, trailingComments, loc, range);
  }

  static create(node: Identifier) {
    return new StepperIdentifier(
      node.name,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range,
    );
  }

  public override isContractible(): boolean {
    // catch undeclared variables
    if (this.name !== 'undefined' && !isBuiltinFunction(this.name)) {
      throw new UnassignedVariableError(this.name, this);
    }
    return false;
  }

  public override isOneStepPossible(): boolean {
    if (this.name !== 'undefined' && !isBuiltinFunction(this.name)) {
      throw new UnassignedVariableError(this.name, this);
    }
    return false;
  }

  public override contract(): StepperIdentifier {
    throw new InternalRuntimeError('Cannot contract Identifier', this);
  }

  public override oneStep(): StepperIdentifier {
    throw new InternalRuntimeError('Cannot oneStep Identifier', this);
  }

  public override substitute(
    id: StepperPattern,
    value: StepperExpression,
    redex: RedexInfo,
  ): StepperExpression {
    if (id.name === this.name) {
      redex.postRedex.push(value);
      return value;
    } else {
      return this;
    }
  }

  public override freeNames(): string[] {
    return [this.name];
  }

  public override allNames(): string[] {
    return [this.name];
  }

  public override rename(before: string, after: string) {
    return before === this.name
      ? new StepperIdentifier(
          after,
          this.leadingComments,
          this.trailingComments,
          this.loc,
          this.range,
        )
      : this;
  }
}
