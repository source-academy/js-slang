import { StepperBinaryExpression } from "./Expression/BinaryExpression";
import { StepperIdentifier } from "./Expression/Identifier";
import { StepperLiteral } from "./Expression/Literal";
import { StepperUnaryExpression } from "./Expression/UnaryExpression";

export type StepperExpression = StepperUnaryExpression | StepperBinaryExpression | StepperLiteral | StepperPattern;
export type StepperPattern = StepperIdentifier

export const undefinedNode = new StepperLiteral('undefined');
