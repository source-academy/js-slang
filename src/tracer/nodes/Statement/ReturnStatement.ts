import type { Comment, ReturnStatement, SourceLocation } from 'estree'
import type { StepperExpression, StepperPattern } from '..'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'
import type { RedexInfo } from '../..'
import assert from '../../../utils/assert'

export class StepperReturnStatement
  extends StepperBaseNode<ReturnStatement>
  implements ReturnStatement
{
  constructor(
    public readonly argument: StepperExpression | null,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined
  ) {
    super('ReturnStatement', leadingComments, trailingComments, loc, range)
  }

  static create(node: ReturnStatement) {
    return new StepperReturnStatement(
      node.argument ? (convert(node.argument) as StepperExpression) : null,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  public override isContractible(): boolean {
    return true
  }

  public override isOneStepPossible(): boolean {
    return true
  }

  public override contract(redex: RedexInfo): StepperExpression {
    assert(!!this.argument, 'Cannot contract return statement without argument', this)

    redex.preRedex = [this]
    redex.postRedex = [this.argument]
    return this.argument
  }

  contractEmpty(redex: RedexInfo) {
    redex.preRedex = [this]
    redex.postRedex = []
  }

  public override oneStep(redex: RedexInfo): StepperExpression {
    assert(!!this.argument, 'Cannot step return statement without argument', this)
    return this.contract(redex)
  }

  public override substitute(
    id: StepperPattern,
    value: StepperExpression,
    redex: RedexInfo
  ): StepperBaseNode {
    return new StepperReturnStatement(
      this.argument ? this.argument.substitute(id, value, redex) : null,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  public override freeNames(): string[] {
    return this.argument ? this.argument.freeNames() : []
  }

  public override allNames(): string[] {
    return this.argument ? this.argument.allNames() : []
  }

  public override rename(before: string, after: string): StepperReturnStatement {
    return new StepperReturnStatement(
      this.argument ? this.argument.rename(before, after) : null,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
