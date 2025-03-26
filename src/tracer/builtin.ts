import { StepperExpression } from "./nodes";
import { StepperArrayExpression } from "./nodes/Expression/ArrayExpression";
import { StepperLiteral } from "./nodes/Expression/Literal";

export const builtinFunctions = {
    pair: (args: StepperExpression[]): StepperExpression => {
        return new StepperArrayExpression([args[0], args[1]]);
    },
    list: (args: StepperExpression[]): StepperExpression => {
        if (args.length === 0) {
            return new StepperLiteral(null);
        }
        return builtinFunctions.pair([args[0], builtinFunctions.list(args.slice(1))]);
    },
    head: (args: StepperExpression[]): StepperExpression => {
        console.log(args)
        return (args[0] as StepperArrayExpression).elements[0] as StepperExpression;
    },
    tail: (args: StepperExpression[]): StepperExpression => {
        return (args[0] as StepperArrayExpression).elements[1] as StepperArrayExpression;
    }
}