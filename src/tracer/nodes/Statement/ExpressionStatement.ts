import type { Comment, SourceLocation, ExpressionStatement } from 'estree'
import type { StepperBaseNode } from '../../interface'
import { convert } from '../../generator'
import type { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'

export class StepperExpressionStatement implements ExpressionStatement, StepperBaseNode {
  type: 'ExpressionStatement'
  expression: StepperExpression
  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined

  constructor(
    expression: StepperExpression,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined
  ) {
    this.type = 'ExpressionStatement'
    this.expression = expression
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
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

  isContractible(): boolean {
    return this.expression.isContractible()
  }
  isOneStepPossible(): boolean {
    return this.expression.isOneStepPossible()
  }
  contract(): StepperExpressionStatement {
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

  oneStep(): StepperExpressionStatement {
    return new StepperExpressionStatement(
      this.expression.oneStep(),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return new StepperExpressionStatement(
      this.expression.substitute(id, value),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  freeNames(): string[] {
    return this.expression.freeNames()
  }

  allNames(): string[] {
    return this.expression.allNames()
  }

  rename(before: string, after: string): StepperExpressionStatement {
    return new StepperExpressionStatement(
      this.expression.rename(before, after),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
