import type { StepperBlockStatement } from './BlockStatement'
import type { StepperDebuggerStatement } from './DebuggerStatement'
import type { StepperExpressionStatement } from './ExpressionStatement'
import type { StepperFunctionDeclaration } from './FunctionDeclaration'
import type { StepperIfStatement } from './IfStatement'
import type { StepperReturnStatement } from './ReturnStatement'
import type { StepperVariableDeclaration } from './VariableDeclaration'

export type StepperStatement =
  | StepperBlockStatement
  | StepperExpressionStatement
  | StepperDebuggerStatement
  | StepperFunctionDeclaration
  | StepperIfStatement
  | StepperReturnStatement
  | StepperVariableDeclaration
