import { BinaryExpression, Expression, SimpleLiteral, UnaryExpression } from 'estree'
import { StepperBinaryExpression } from './BinaryExpression'
import { StepperUnaryExpression } from './UnaryExpression'
import { StepperLiteral } from './Literal'

export type StepperExpression = StepperBinaryExpression | StepperUnaryExpression | StepperLiteral

export function createStepperExpression(expression: Expression): StepperExpression {
  switch (expression.type) {
    case 'BinaryExpression':
      return new StepperBinaryExpression(expression as BinaryExpression)
    case 'UnaryExpression':
      return new StepperUnaryExpression(expression as UnaryExpression)
    case 'Literal':
      return new StepperLiteral(expression as SimpleLiteral)
    default:
      throw new Error(`Unsupported expression type: ${expression.type}`)
  }
}
