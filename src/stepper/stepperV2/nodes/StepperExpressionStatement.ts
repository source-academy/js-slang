import { Comment, SimpleLiteral, SourceLocation, ExpressionStatement } from 'estree'
import { StepperBaseNode } from '../interface'
import { createStepperExpression, StepperExpression } from './Expression'

export class StepperExpressionStatement implements ExpressionStatement, StepperBaseNode {
  constructor(expression: ExpressionStatement) {
    this.expression = createStepperExpression(expression.expression) as StepperExpression
    this.leadingComments = expression.leadingComments
    this.trailingComments = expression.trailingComments
    this.loc = expression.loc
    this.range = expression.range
  }

  isContractible(): boolean {
    return this.expression.isContractible()
  }
  isOneStepPossible(): boolean {
    return this.expression.isOneStepPossible()
  }
  contract(): SimpleLiteral & StepperBaseNode {
    return this.expression.contract()
  }
  oneStep(): StepperExpression {
    return this.expression.oneStep()
  }
  type: 'ExpressionStatement'
  expression: StepperExpression
  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined
}
