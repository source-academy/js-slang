import type { Comment, SimpleLiteral, SourceLocation } from 'estree';
import type { StepperExpression } from '..';
import { StepperBaseNode } from '../../interface';
import { InternalRuntimeError } from '../../../errors/base';

/**
 * This class represents a literal node in the stepper's AST (Abstract Syntax Tree).
 * It extends both SimpleLiteral and StepperBaseNode to integrate with the stepper system.
 * The class stores value-related properties such as type, value, raw representation,
 * and location metadata.
 *
 * @method isContractible() Indicates whether this node can be contracted (returns false).
 * @method isOneStepPossible() Indicates whether a single step evaluation is possible (returns false).
 * @method contract() Throws an error as contraction is not implemented.
 * @method oneStep() Throws an error as one-step evaluation is not implemented.
 */
export class StepperLiteral extends StepperBaseNode<SimpleLiteral> implements SimpleLiteral {
  constructor(
    public readonly value: string | number | boolean | null,
    public readonly raw?: string,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number],
  ) {
    super('Literal', leadingComments, trailingComments, loc, range);
  }

  static create(literal: SimpleLiteral) {
    return new StepperLiteral(
      literal.value,
      literal.raw,
      literal.leadingComments,
      literal.trailingComments,
      literal.loc,
      literal.range,
    );
  }

  public override isContractible(): boolean {
    return false;
  }

  public override isOneStepPossible(): boolean {
    return false;
  }

  public override contract(): StepperLiteral {
    throw new InternalRuntimeError('Cannot contract Literal', this);
  }

  public override oneStep(): StepperLiteral {
    throw new InternalRuntimeError('Cannot oneStep Literal', this);
  }

  public override substitute(): StepperLiteral {
    return this;
  }

  public override freeNames(): string[] {
    return [];
  }

  public override allNames(): string[] {
    return [];
  }

  public override rename(_before: string, _after: string): StepperExpression {
    return new StepperLiteral(
      this.value,
      this.raw,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range,
    );
  }
}
