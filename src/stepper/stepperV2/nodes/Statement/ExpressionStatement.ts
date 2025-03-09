import { Comment, SourceLocation, ExpressionStatement } from 'estree'
import { StepperBaseNode } from '../../interface'
import { convert } from '../../generator'
import { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'

export class StepperExpressionStatement implements ExpressionStatement, StepperBaseNode {
  
  isContractible(): boolean {
    return this.expression.isContractible()
  }
  isOneStepPossible(): boolean {
    return this.expression.isOneStepPossible()
  }
  contract(): StepperExpressionStatement {
    return new StepperExpressionStatement(this.expression.contract())
  }

  contractEmpty() { 
    // Handle cases such as 1; 2; -> 2;
    redex.preRedex = [this]
    redex.postRedex = []
  }
  
  oneStep(): StepperExpressionStatement {
    return new StepperExpressionStatement(this.expression.oneStep())
  }

  type: 'ExpressionStatement'
  expression: StepperExpression
  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined


  static create(node: ExpressionStatement) {
    return new StepperExpressionStatement(
      convert(node.expression) as StepperExpression,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  constructor(
    expression: StepperExpression,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined,
  ) {
    this.type = 'ExpressionStatement'
    this.expression = expression;
    this.leadingComments = leadingComments;
    this.trailingComments = trailingComments;
    this.loc = loc;
    this.range = range;
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
      return new StepperExpressionStatement(this.expression.substitute(id, value))
  }

  freeNames(): string[] {
    return this.expression.freeNames();
  }
}
