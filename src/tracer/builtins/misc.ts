import { arity } from "../../stdlib/misc";
import { StepperExpression } from "../nodes";
import { StepperArrowFunctionExpression } from "../nodes/Expression/ArrowFunctionExpression";
import { StepperIdentifier } from "../nodes/Expression/Identifier";
import { StepperLiteral } from "../nodes/Expression/Literal";
import { listBuiltinFunctions } from "./lists";

export const miscBuiltinFunctions = {
    arity: (args: StepperExpression[]): StepperExpression => {
        if (args[0] instanceof StepperArrowFunctionExpression) {
            return new StepperLiteral(args[0].params.length);
        }

        if (args[0] instanceof StepperIdentifier) {
            // TODO: This just returns 1 for all builtins, we need to actually check the arity
            if (Object.keys(listBuiltinFunctions).includes(args[0].name)) {
                return new StepperLiteral(1);
            }
            if (Object.keys(Math).includes(args[0].name)) {
                return new StepperLiteral(arity(Math[args[0].name as keyof typeof Math] as Function));
            }
        }
        return new StepperLiteral(0);
    },
    char_at: (args: StepperExpression[]): StepperExpression => {
        const str = (args[0] as StepperLiteral).value as string;
        const index = (args[1] as StepperLiteral).value as number;
        return new StepperLiteral(str.charAt(index));
    },
    display: (args: StepperExpression[]): StepperExpression => {
        return args[0];
    },
    error: (args: StepperExpression[]): StepperExpression => {
        const errorMessage = (args[0] as StepperLiteral).value as string;
        throw new Error(errorMessage);
    },
    get_time: (args: StepperExpression[]): StepperExpression => {
        return new StepperLiteral(Date.now());
    },
    is_boolean: (args: StepperExpression[]): StepperExpression => {
        return new StepperLiteral(typeof (args[0] as StepperLiteral).value === 'boolean');
    },
    is_function: (args: StepperExpression[]): StepperExpression => {
        return new StepperLiteral(args[0] instanceof StepperArrowFunctionExpression);
    },
    is_number: (args: StepperExpression[]): StepperExpression => {
        return new StepperLiteral(typeof (args[0] as StepperLiteral).value === 'number');
    },
    is_string: (args: StepperExpression[]): StepperExpression => {
        return new StepperLiteral(typeof (args[0] as StepperLiteral).value === 'string');
    },
    is_undefined: (args: StepperExpression[]): StepperExpression => {
        return new StepperLiteral((args[0] as StepperLiteral).value === undefined);
    },
    parse_int: (args: StepperExpression[]): StepperExpression => {
        const str = (args[0] as StepperLiteral).value as string;
        const radix = args.length > 1 ? (args[1] as StepperLiteral).value as number : 10;
        return new StepperLiteral(parseInt(str, radix));
    },
    prompt: (args: StepperExpression[]): StepperExpression => {
        const message = (args[0] as StepperLiteral).value as string;
        const result = window.prompt(message);
        return new StepperLiteral(result !== null ? result : null);
    },
    stringify: (args: StepperExpression[]): StepperExpression => {
        const value = args[0];
        let stringified;
        
        if (value instanceof StepperLiteral) {
            stringified = JSON.stringify(value.value);
        } else {
            stringified = value.toString();
        }
        
        return new StepperLiteral(stringified);
    },
}