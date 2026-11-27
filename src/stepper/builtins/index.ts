import type es from 'estree';
import { convert } from '../generator';
import type { StepperExpression } from '../nodes';
import { StepperIdentifier } from '../nodes/Expression/Identifier';
import { StepperLiteral } from '../nodes/Expression/Literal';
import type { StepperFunctionApplication } from '../nodes/Expression/FunctionApplication';
import type { RedexInfo } from '..';
import { InvalidParameterTypeError } from '../../errors/rttcErrors';
import { MATH_LIBRARY_NAMES } from '../../stdlib/mathLibrary';
import { validateFunctionArgCount } from '../../utils/operators';
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
  MATH_LIBRARY_NAMES.filter(name => typeof Math[name] !== 'function').forEach(name => {
    inputNode = inputNode.substitute(
      new StepperIdentifier('math_' + name),
      new StepperLiteral(Math[name as keyof typeof Math] as number),
      redex,
    );
  });
  return inputNode;
}

/**
 * Retrieves the builtin with the given name. Also verifies
 * the argument count
 */
export function getBuiltinFunction(
  name: string,
  call: StepperFunctionApplication,
): StepperExpression {
  const args = call.arguments;

  if (isMathName(name)) {
    const mathFnName = name.slice('math_'.length);
    // Is a math function
    const fn = (Math as any)[mathFnName];

    if (mathFnName === 'min' || mathFnName === 'max') {
      // Assume that only min and max have varargs
      validateFunctionArgCount(call, args.length, 0, true, name);
    } else {
      // And use f.length for everything else
      validateFunctionArgCount(call, args.length, fn.length, undefined, name);
    }

    const argVal = args.map(arg => (arg as StepperLiteral).value);
    argVal.forEach(arg => {
      if (typeof arg !== 'number' && typeof arg !== 'bigint') {
        throw new InvalidParameterTypeError('number', arg, name, undefined, call);
      }
    });

    const result = fn(...argVal);
    return new StepperLiteral(result, result);
  }

  const calledFunction = builtinFunctions[name as keyof typeof builtinFunctions];

  validateFunctionArgCount(
    call,
    args.length,
    calledFunction.arity,
    name === 'list' ? true : undefined,
    name,
  );

  return calledFunction.definition(args);
}

/**
 * Whether `name` is `math_` followed by a member of Source's Math library (see `MATH_LIBRARY_NAMES`),
 * not by any member that the engine happens to have in `Math`.
 */
function isMathName(name: string): boolean {
  return (
    name.startsWith('math_') &&
    (MATH_LIBRARY_NAMES as readonly string[]).includes(name.slice('math_'.length))
  );
}

export function isBuiltinFunction(name: string): boolean {
  return isMathName(name) || Object.keys(builtinFunctions).includes(name);
}
