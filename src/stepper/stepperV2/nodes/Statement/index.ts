import { StepperBlockStatement } from "./BlockStatement";
import { StepperExpressionStatement } from "./ExpressionStatement";
import { StepperVariableDeclaration } from "./VariableDeclaration";

export type StepperStatement = StepperExpressionStatement | StepperVariableDeclaration;
