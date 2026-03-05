import type { StepperStatement } from './Statement'
import type { StepperArrayExpression } from './Expression/ArrayExpression'
import type { StepperArrowFunctionExpression } from './Expression/ArrowFunctionExpression'
import type { StepperBinaryExpression } from './Expression/BinaryExpression'
import type { StepperConditionalExpression } from './Expression/ConditionalExpression'
import type { StepperFunctionApplication } from './Expression/FunctionApplication'
import type { StepperIdentifier } from './Expression/Identifier'
import { StepperLiteral } from './Expression/Literal'
import type { StepperLogicalExpression } from './Expression/LogicalExpression'
import type { StepperUnaryExpression } from './Expression/UnaryExpression'
import type { StepperProgram } from './Program'
import type { StepperVariableDeclarator } from './Statement/VariableDeclaration'

export type StepperExpression =
  | StepperUnaryExpression
  | StepperBinaryExpression
  | StepperLiteral
  | StepperPattern
  | StepperConditionalExpression
  | StepperFunctionApplication
  | StepperArrowFunctionExpression
  | StepperArrayExpression
  | StepperLogicalExpression

export type StepperPattern = StepperIdentifier

export { StepperStatement }

export type StepperNode =
  | StepperExpression
  | StepperStatement
  | StepperProgram
  | StepperVariableDeclarator

export type NodeTypeToStepperNode<T extends StepperNode['type']> = Extract<StepperNode, { type: T }>

export const undefinedNode = new StepperLiteral('undefined', 'undefined')
