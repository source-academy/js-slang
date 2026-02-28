import type { Comment, ExpressionStatement, SourceLocation } from 'estree'
import type { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'

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
      convert(node.expression) as StepperExpression,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  public override isContractible(): boolean {
    return this.expression.isContractible()
  }
  public override isOneStepPossible(): boolean {
    return this.expression.isOneStepPossible()
  }
  public override contract(): StepperExpressionStatement {
    return new StepperExpressionStatement(
      this.expression.oneStep(),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  contractEmpty() {
    // Handle cases such as 1; 2; -> 2;
    redex.preRedex = [this]
    redex.postRedex = []
  }

  public override oneStep(): StepperExpressionStatement {
    return new StepperExpressionStatement(
      this.expression.oneStep(),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  public override substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return new StepperExpressionStatement(
      this.expression.substitute(id, value),
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
