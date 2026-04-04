import type { Comment, LogicalExpression, LogicalOperator, SourceLocation } from 'estree'
import type { StepperExpression, StepperPattern } from '..'
import type { RedexInfo } from '../..'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'
import assert from '../../../utils/assert'
import { checkIfStatement } from '../../../utils/rttc'
import { InternalRuntimeError } from '../../../errors/runtimeErrors'
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

  public override isContractible(redex: RedexInfo): boolean {
    if (this.left.type === 'Literal') {
      checkIfStatement(this, this.left.value)
      redex.preRedex = [this]
      return true
    }

    return false
  }

  public override isOneStepPossible(redex: RedexInfo): boolean {
    return (
      this.isContractible(redex) ||
      this.left.isOneStepPossible(redex) ||
      this.right.isOneStepPossible(redex)
    )
  }

  public override contract(redex: RedexInfo): StepperExpression {
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

  public override oneStep(redex: RedexInfo): StepperExpression {
    if (this.isContractible(redex)) {
      return this.contract(redex)
    } else if (this.left.isOneStepPossible(redex)) {
      return new StepperLogicalExpression(
        this.operator,
        this.left.oneStep(redex),
        this.right,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
    } else if (this.right.isOneStepPossible(redex)) {
      return new StepperLogicalExpression(
        this.operator,
        this.left,
        this.right.oneStep(redex),
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
    }

    throw new InternalRuntimeError('Cannot oneStep ineligible LogicalExpression', this)
  }

  public override substitute(
    id: StepperPattern,
    value: StepperExpression,
    redex: RedexInfo
  ): StepperExpression {
    return new StepperLogicalExpression(
      this.operator,
      this.left.substitute(id, value, redex),
      this.right.substitute(id, value, redex),
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
