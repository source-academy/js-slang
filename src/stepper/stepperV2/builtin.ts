import { StepperExpression } from "./nodes";
import { StepperArrayExpression } from "./nodes/Expression/ArrayExpression";

export const builtinFunctions = {
    pair: (args: StepperExpression[]) => {
        return new StepperArrayExpression([args[0], args[1]]);
    }
}