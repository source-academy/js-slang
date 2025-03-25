import { StepperArrayExpression } from "./Expression/ArrayExpression";
import { StepperArrowFunctionExpression } from "./Expression/ArrowFunctionExpression";
import { StepperBinaryExpression } from "./Expression/BinaryExpression";
import { StepperConditionalExpression } from "./Expression/ConditionalExpression";
import { StepperFunctionApplication } from "./Expression/FunctionApplication";
import { StepperIdentifier } from "./Expression/Identifier";
import { StepperLiteral } from "./Expression/Literal";
import { StepperUnaryExpression } from "./Expression/UnaryExpression";

export type StepperExpression = StepperUnaryExpression | StepperBinaryExpression | StepperLiteral | StepperPattern | StepperConditionalExpression | StepperFunctionApplication | StepperArrowFunctionExpression | StepperArrayExpression;
export type StepperPattern = StepperIdentifier

export const undefinedNode = new StepperLiteral('undefined');
