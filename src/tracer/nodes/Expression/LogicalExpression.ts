import type { Comment, LogicalExpression, LogicalOperator, SourceLocation } from 'estree'
import type { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'
import assert from '../../../utils/assert'
import { checkIfStatement } from '../../../utils/rttc'
import { StepperLiteral } from './Literal'

export class StepperLogicalExpression
  extends StepperBaseNode<LogicalExpression>
  implements LogicalExpression
{
  constructor(
    public readonly operator: LogicalOperator,
    public readonly left: StepperExpression,
    public readonly right: StepperExpression,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number]
  ) {
    super('LogicalExpression', leadingComments, trailingComments, loc, range)
  }

  static create(node: LogicalExpression) {
    return new StepperLogicalExpression(
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
    if (this.left.type === 'Literal') {
      const error = checkIfStatement(this, this.left.value)
      if (error) {
        throw error
      }

      redex.preRedex = [this]
      return true
    }

    return false
  }

  public override isOneStepPossible(): boolean {
    return this.isContractible() || this.left.isOneStepPossible() || this.right.isOneStepPossible()
  }

  public override contract(): StepperExpression {
    redex.preRedex = [this]

    assert(this.left.type === 'Literal', 'Left operand must be a literal to contract')
    const leftValue = this.left.value

    if (this.operator === '&&' && !leftValue) {
      let ret = new StepperLiteral(
        false,
        undefined,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
      redex.postRedex = [ret]
      return ret
    } else if (this.operator === '||' && leftValue) {
      let ret = new StepperLiteral(
        true,
        undefined,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
      redex.postRedex = [ret]
      return ret
    } else {
      return this.right
    }
  }

  public override oneStep(): StepperExpression {
    if (this.isContractible()) {
      return this.contract()
    } else if (this.left.isOneStepPossible()) {
      return new StepperLogicalExpression(
        this.operator,
        this.left.oneStep(),
        this.right,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
    } else if (this.right.isOneStepPossible()) {
      return new StepperLogicalExpression(
        this.operator,
        this.left,
        this.right.oneStep(),
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
    } else {
      throw new Error('No step possible')
    }
  }

  public override substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    return new StepperLogicalExpression(
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
    return new StepperLogicalExpression(
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
