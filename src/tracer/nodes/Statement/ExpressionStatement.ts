import type { Comment, ExpressionStatement, SourceLocation } from 'estree'
import type { StepperExpression, StepperPattern } from '..'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'
import type { RedexInfo } from '../..'

export class StepperExpressionStatement
  extends StepperBaseNode<ExpressionStatement>
  implements ExpressionStatement
{
  constructor(
    public readonly expression: StepperExpression,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined
  ) {
    super('ExpressionStatement', leadingComments, trailingComments, loc, range)
  }

  static create(node: ExpressionStatement) {
    return new StepperExpressionStatement(
      convert(node.expression),
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  public override isContractible(redex: RedexInfo): boolean {
    return this.expression.isContractible(redex)
  }

  public override isOneStepPossible(redex: RedexInfo): boolean {
    return this.expression.isOneStepPossible(redex)
  }

  public override contract(redex: RedexInfo): StepperExpressionStatement {
    return new StepperExpressionStatement(
      this.expression.oneStep(redex),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  contractEmpty(redex: RedexInfo) {
    // Handle cases such as 1; 2; -> 2;
    redex.preRedex = [this]
    redex.postRedex = []
  }

  public override oneStep(redex: RedexInfo): StepperExpressionStatement {
    return new StepperExpressionStatement(
      this.expression.oneStep(redex),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  public override substitute(
    id: StepperPattern,
    value: StepperExpression,
    redex: RedexInfo
  ): StepperBaseNode {
    return new StepperExpressionStatement(
      this.expression.substitute(id, value, redex),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  public override freeNames(): string[] {
    return this.expression.freeNames()
  }

  public override allNames(): string[] {
    return this.expression.allNames()
  }

  public override rename(before: string, after: string): StepperExpressionStatement {
    return new StepperExpressionStatement(
      this.expression.rename(before, after),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
