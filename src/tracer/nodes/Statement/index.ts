import { StepperBlockStatement } from './BlockStatement'
import { StepperExpressionStatement } from './ExpressionStatement'
import { StepperFunctionDeclaration } from './FunctionDeclaration'
import { StepperReturnStatement } from './ReturnStatement'
import { StepperVariableDeclaration } from './VariableDeclaration'

export type StepperStatement =
  | StepperExpressionStatement
  | StepperVariableDeclaration
  | StepperBlockStatement
  | StepperReturnStatement
  | StepperFunctionDeclaration
