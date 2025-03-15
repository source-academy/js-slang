import { StepperBlockStatement } from "./BlockStatement";
import { StepperExpressionStatement } from "./ExpressionStatement";
import { StepperIfStatement } from "./IfStatement";
import { StepperVariableDeclaration } from "./VariableDeclaration";

export type StepperStatement = StepperExpressionStatement | StepperVariableDeclaration | StepperBlockStatement | StepperIfStatement;
