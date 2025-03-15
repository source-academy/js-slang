import { StepperBinaryExpression } from "./Expression/BinaryExpression";
import { StepperConditionalExpression } from "./Expression/ConditionalExpression";
import { StepperIdentifier } from "./Expression/Identifier";
import { StepperLiteral } from "./Expression/Literal";
import { StepperUnaryExpression } from "./Expression/UnaryExpression";

export type StepperExpression = StepperUnaryExpression | StepperBinaryExpression | StepperLiteral | StepperPattern | StepperConditionalExpression;
export type StepperPattern = StepperIdentifier

export const undefinedNode = new StepperLiteral('undefined');
