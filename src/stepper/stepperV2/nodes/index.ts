import { StepperBinaryExpression } from "./BinaryExpression";
import { StepperLiteral } from "./Literal";
import { StepperUnaryExpression } from "./UnaryExpression";

export type StepperExpression = StepperUnaryExpression | StepperBinaryExpression | StepperLiteral;
export const undefinedNode = new StepperLiteral('undefined');
