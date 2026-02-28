import type { Comment, ConditionalExpression, SourceLocation } from 'estree'
import type { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'
import { checkIfStatement } from '../../../utils/rttc'

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
    range?: [number, number]
  ) {
    super('ConditionalExpression', leadingComments, trailingComments, loc, range)
  }

  static create(node: ConditionalExpression) {
    return new StepperConditionalExpression(
      convert(node.test) as StepperExpression,
      convert(node.consequent) as StepperExpression,
      convert(node.alternate) as StepperExpression,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  public override isContractible(): boolean {
    if (this.test.type !== 'Literal') return false
    const test_value = this.test.value
    checkIfStatement(this, test_value)

    redex.preRedex = [this]
    return true
  }

  public override isOneStepPossible(): boolean {
    return this.isContractible() || this.test.isOneStepPossible()
  }

  public override contract(): StepperExpression {
    redex.preRedex = [this]
    if (this.test.type !== 'Literal' || typeof this.test.value !== 'boolean') {
      throw new Error('Cannot contract non-boolean literal test')
    }

    const result = this.test.value ? this.consequent : this.alternate
    redex.postRedex = [result]
    return result
  }

  public override oneStep(): StepperExpression {
    if (this.isContractible()) {
      return this.contract()
    }

    return new StepperConditionalExpression(
      this.test.oneStep(),
      this.consequent,
      this.alternate,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  public override substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    return new StepperConditionalExpression(
      this.test.substitute(id, value),
      this.consequent.substitute(id, value),
      this.alternate.substitute(id, value),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  public override freeNames(): string[] {
    return Array.from(
      new Set([
        ...this.test.freeNames(),
        ...this.consequent.freeNames(),
        ...this.alternate.freeNames()
      ])
    )
  }

  public override allNames(): string[] {
    return Array.from(
      new Set([
        ...this.test.allNames(),
        ...this.consequent.allNames(),
        ...this.alternate.allNames()
      ])
    )
  }

  public override rename(before: string, after: string): StepperExpression {
    return new StepperConditionalExpression(
      this.test.rename(before, after),
      this.consequent.rename(before, after),
      this.alternate.rename(before, after),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
