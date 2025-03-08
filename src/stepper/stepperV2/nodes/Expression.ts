import {
  BinaryExpression,
  Expression,
  ExpressionStatement,
  SimpleLiteral,
  Statement,
  UnaryExpression
} from 'estree'
import { StepperBinaryExpression } from './BinaryExpression'
import { StepperUnaryExpression } from './UnaryExpression'
import { StepperLiteral } from './Literal'
import { StepperExpressionStatement } from './StepperExpressionStatement'

export type StepperExpression = StepperBinaryExpression | StepperUnaryExpression | StepperLiteral

export function createStepperExpression(
  expression: Expression | ExpressionStatement
): StepperExpression | StepperExpressionStatement {
  switch (expression.type) {
    case 'BinaryExpression':
      return new StepperBinaryExpression(expression as BinaryExpression)
    case 'UnaryExpression':
      return new StepperUnaryExpression(expression as UnaryExpression)
    case 'Literal':
      return new StepperLiteral(expression as SimpleLiteral)
    case 'ExpressionStatement':
      return new StepperExpressionStatement(expression as StepperExpression)
    default:
      throw new Error(`Unsupported expression type: ${expression.type}`)
  }
}
