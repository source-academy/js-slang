import type es from 'estree';
import { convert } from '../generator';
import type { StepperExpression } from '../nodes';
import { StepperIdentifier } from '../nodes/Expression/Identifier';
import { StepperLiteral } from '../nodes/Expression/Literal';
import { InvalidNumberOfArgumentsError } from '../../errors/errors';
import type { StepperFunctionApplication } from '../nodes/Expression/FunctionApplication';
import type { RedexInfo } from '..';
import { InvalidParameterTypeError } from '../../errors/rttcErrors';
import { auxiliaryBuiltinFunctions } from './auxiliary';
import { listBuiltinFunctions } from './lists';
import { miscBuiltinFunctions } from './misc';

const builtinFunctions = {
  ...listBuiltinFunctions,
  ...miscBuiltinFunctions,
  ...auxiliaryBuiltinFunctions,
};

export function prelude(node: es.BaseNode, redex: RedexInfo) {
  let inputNode = convert(node);

  // Substitute math constant
  Object.getOwnPropertyNames(Math)
    .filter(name => name in Math && typeof Math[name as keyof typeof Math] !== 'function')
    .forEach(name => {
      inputNode = inputNode.substitute(
        new StepperIdentifier('math_' + name),
        new StepperLiteral(Math[name as keyof typeof Math] as number),
        redex,
      );
    });
  return inputNode;
}

export function getBuiltinFunction(
  name: string,
  call: StepperFunctionApplication,
): StepperExpression {
  const args = call.arguments;

  if (name.startsWith('math_')) {
    const mathFnName = name.split('_')[1];

    if (mathFnName in Math) {
      const fn = (Math as any)[mathFnName];
      const argVal = args.map(arg => (arg as StepperLiteral).value);
      argVal.forEach(arg => {
        if (typeof arg !== 'number' && typeof arg !== 'bigint') {
          throw new InvalidParameterTypeError('number', arg, name, undefined, call);
        }
      });

      const result = fn(...argVal);
      return new StepperLiteral(result, result);
    }
  }

  const calledFunction = builtinFunctions[name as keyof typeof builtinFunctions];

  if (calledFunction.arity != args.length && name !== 'list') {
    // brute force way to fix this issue
    throw new InvalidNumberOfArgumentsError(call, calledFunction.arity, args.length);
  }

  return calledFunction.definition(args);
}

export function isBuiltinFunction(name: string): boolean {
  return name.startsWith('math_') || Object.keys(builtinFunctions).includes(name);
}
