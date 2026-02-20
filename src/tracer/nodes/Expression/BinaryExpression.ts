import type { BinaryExpression, BinaryOperator, Comment, SourceLocation } from 'estree'
import type { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'
import { checkBinaryExpression } from '../../../utils/rttc'
import { Chapter } from '../../../langs'
import assert from '../../../utils/assert'
import { StepperLiteral } from './Literal'

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
    range?: [number, number]
  ) {
    super('BinaryExpression', leadingComments, trailingComments, loc, range)
  }

  static create(node: BinaryExpression) {
    return new StepperBinaryExpression(
      node.operator,
      convert(node.left) as StepperExpression,
      convert(node.right) as StepperExpression,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  public override isContractible(): boolean {
    if (this.left.type !== 'Literal' || this.right.type !== 'Literal') {
      return false
    }

    const leftType = typeof this.left.value
    const rightType = typeof this.right.value

    const markContractible = () => {
      redex.preRedex = [this]
      return true
    }

    const error = checkBinaryExpression(
      this,
      this.operator,
      Chapter.SOURCE_2,
      this.left.value,
      this.right.value
    )
    if (error) {
      throw error
    }

    if (leftType === 'string' && rightType === 'string') {
      if (['+', '===', '!==', '<', '>', '<=', '>='].includes(this.operator)) {
        return markContractible()
      }
    }

    if (leftType === 'number' && rightType === 'number') {
      if (['*', '+', '/', '-', '===', '!==', '<', '>', '<=', '>=', '%'].includes(this.operator)) {
        return markContractible()
      }
    }

    return false
  }

  public override isOneStepPossible(): boolean {
    return this.isContractible() || this.left.isOneStepPossible() || this.right.isOneStepPossible()
  }

  public override contract(): StepperExpression {
    redex.preRedex = [this]
    assert(
      this.left.type === 'Literal' && this.right.type === 'Literal',
      'BinaryExpression cannot be contracted unless both sides are Literals'
    )

    const left = this.left.value
    const right = this.right.value

    const op = this.operator as string

    const value =
      (this.operator as string) === '&&'
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
                                : left! > right!

    let ret = new StepperLiteral(
      value,
      typeof value === 'string' ? '"' + value + '"' : value !== null ? value.toString() : 'null',
      undefined,
      undefined,
      this.loc,
      this.range
    )
    redex.postRedex = [ret]
    return ret
  }

  public override oneStep(): StepperExpression {
    return this.isContractible()
      ? this.contract()
      : this.left.isOneStepPossible()
        ? new StepperBinaryExpression(this.operator, this.left.oneStep(), this.right)
        : new StepperBinaryExpression(this.operator, this.left, this.right.oneStep())
  }

  public override substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    return new StepperBinaryExpression(
      this.operator,
      this.left.substitute(id, value),
      this.right.substitute(id, value),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  public override freeNames(): string[] {
    return Array.from(new Set([this.left.freeNames(), this.right.freeNames()].flat()))
  }

  public override allNames(): string[] {
    return Array.from(new Set([this.left.allNames(), this.right.allNames()].flat()))
  }

  public override rename(before: string, after: string): StepperExpression {
    return new StepperBinaryExpression(
      this.operator,
      this.left.rename(before, after),
      this.right.rename(before, after),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
