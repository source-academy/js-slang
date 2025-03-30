import { StepperBaseNode } from "../interface";
import { StepperExpression } from "../nodes";
import { StepperIdentifier } from "../nodes/Expression/Identifier";
import { StepperLiteral } from "../nodes/Expression/Literal";
import { listBuiltinFunctions } from "./lists";
import { miscBuiltinFunctions } from "./misc";

const builtinFunctions = {
    ...listBuiltinFunctions,
    ...miscBuiltinFunctions,
}

export function prelude(inputNode: StepperBaseNode) {
  // Substitute math constant
  Object.getOwnPropertyNames(Math)
    .filter(name => name in Math && typeof Math[name as keyof typeof Math] !== 'function')
    .forEach(name => {
        inputNode = inputNode.substitute(
            new StepperIdentifier('math_' + name), 
            new StepperLiteral(Math[name as keyof typeof Math] as number)
        )
    });
    return inputNode;
}


export function getBuiltinFunction(name: string, args: StepperExpression[]): StepperExpression {
    if (name.startsWith('math_')) {
        const mathFnName = name.split('_')[1];
        
        if (mathFnName in Math) {
            const fn = (Math as any)[mathFnName];
            const argVal = args.map(arg => (arg as StepperLiteral).value);
            return new StepperLiteral(fn(...argVal));
        }
    }
    return builtinFunctions[name as keyof typeof builtinFunctions].definition(args);
}

export function isBuiltinFunction(name: string): boolean {
    return name.startsWith('math_') || Object.keys(builtinFunctions).includes(name);
}

