import type { BinaryExpression, BinaryOperator, Comment, SourceLocation } from 'estree';
import type { StepperExpression, StepperPattern } from '..';
import { convert } from '../../generator';
import { StepperBaseNode } from '../../interface';
import { checkBinaryExpression } from '../../../utils/rttc';
import { Chapter } from '../../../langs';
import assert from '../../../utils/assert';
import type { RedexInfo } from '../..';
import { StepperLiteral } from './Literal';
import { getStepperNodeValue, isStepperValue } from './utils';

export class StepperBinaryExpression
  extends StepperBaseNode<BinaryExpression>
  implements BinaryExpression
{
  constructor(
    public readonly operator: BinaryOperator,
    public readonly left: StepperExpression,
    public readonly right: StepperExpression,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number],
  ) {
    super('BinaryExpression', leadingComments, trailingComments, loc, range);
  }

  static create(node: BinaryExpression) {
    return new StepperBinaryExpression(
      node.operator,
      convert(node.left),
      convert(node.right),
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range,
    );
  }

  public override isContractible(redex: RedexInfo): boolean {
    const leftFullyReduced = !this.left.isOneStepPossible(redex);
    const rightFullyReduced = !this.right.isOneStepPossible(redex);

    // If either side can still be reduced, this expression is not yet contractible.
    if (!leftFullyReduced || !rightFullyReduced) {
      return false;
    }

    // Both sides are fully reduced. Perform runtime type checking only if both sides
    // are recognized stepper values (Literals, functions, arrays). Stuck identifiers
    // (e.g., builtin function names) are not type-checked here.
    if (isStepperValue(this.left) && isStepperValue(this.right)) {
      const leftValue = getStepperNodeValue(this.left);
      const rightValue = getStepperNodeValue(this.right);

      // checkBinaryExpression will throw a RuntimeTypeError if the types are incompatible.
      // This error propagates up to the stepper loop, which catches it and shows "Evaluation stuck".
      checkBinaryExpression(this, this.operator, Chapter.SOURCE_2, [leftValue, rightValue]);
    }

    // Only contract if both are Literals with compatible types.
    if (this.left.type !== 'Literal' || this.right.type !== 'Literal') {
      return false;
    }

    const leftType = typeof this.left.value;
    const rightType = typeof this.right.value;

    const markContractible = () => {
      redex.preRedex = [this];
      return true;
    };

    if (leftType === 'string' && rightType === 'string') {
      if (['+', '===', '!==', '<', '>', '<=', '>='].includes(this.operator)) {
        return markContractible();
      }
    }

    if (leftType === 'number' && rightType === 'number') {
      if (['*', '+', '/', '-', '===', '!==', '<', '>', '<=', '>=', '%'].includes(this.operator)) {
        return markContractible();
      }
    }

    return false;
  }

  public override isOneStepPossible(redex: RedexInfo): boolean {
    return (
      this.left.isOneStepPossible(redex) ||
      this.right.isOneStepPossible(redex) ||
      this.isContractible(redex)
    );
  }

  public override contract(redex: RedexInfo): StepperExpression {
    redex.preRedex = [this];
    assert(
      this.left.type === 'Literal' && this.right.type === 'Literal',
      'BinaryExpression cannot be contracted unless both sides are Literals',
    );

    const left = this.left.value;
    const right = this.right.value;

    const op = this.operator as string;

    const value =
      op === '&&'
        ? left && right
        : op === '||'
          ? left || right
          : op === '+' && typeof left === 'number' && typeof right === 'number'
            ? left + right
            : op === '+' && typeof left === 'string' && typeof right === 'string'
              ? left + right
              : op === '-'
                ? (left as number) - (right as number)
                : op === '*'
                  ? (left as number) * (right as number)
                  : op === '%'
                    ? (left as number) % (right as number)
                    : op === '/'
                      ? (left as number) / (right as number)
                      : op === '==='
                        ? left === right
                        : op === '!=='
                          ? left !== right
                          : op === '<'
                            ? left! < right!
                            : op === '<='
                              ? left! <= right!
                              : op === '>='
                                ? left! >= right!
                                : left! > right!;

    let ret = new StepperLiteral(
      value,
      typeof value === 'string' ? '"' + value + '"' : value !== null ? value.toString() : 'null',
      undefined,
      undefined,
      this.loc,
      this.range,
    );
    redex.postRedex = [ret];
    return ret;
  }

  public override oneStep(redex: RedexInfo): StepperExpression {
    return this.isContractible(redex)
      ? this.contract(redex)
      : this.left.isOneStepPossible(redex)
        ? new StepperBinaryExpression(this.operator, this.left.oneStep(redex), this.right)
        : new StepperBinaryExpression(this.operator, this.left, this.right.oneStep(redex));
  }

  public override substitute(
    id: StepperPattern,
    value: StepperExpression,
    redex: RedexInfo,
  ): StepperExpression {
    return new StepperBinaryExpression(
      this.operator,
      this.left.substitute(id, value, redex),
      this.right.substitute(id, value, redex),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range,
    );
  }

  public override freeNames(): string[] {
    return Array.from(new Set([this.left.freeNames(), this.right.freeNames()].flat()));
  }

  public override allNames(): string[] {
    return Array.from(new Set([this.left.allNames(), this.right.allNames()].flat()));
  }

  public override rename(before: string, after: string): StepperExpression {
    return new StepperBinaryExpression(
      this.operator,
      this.left.rename(before, after),
      this.right.rename(before, after),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range,
    );
  }
}
