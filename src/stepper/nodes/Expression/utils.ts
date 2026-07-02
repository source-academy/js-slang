import type { StepperExpression } from '..';

/**
 * Checks whether a fully-reduced stepper node represents a concrete value
 * that can be type-checked by the runtime type checking functions.
 *
 * Returns `true` for:
 * - Literal nodes (numbers, strings, booleans, null)
 * - ArrowFunctionExpression nodes (functions)
 * - ArrayExpression nodes with all elements fully reduced
 * - Identifier nodes representing `undefined`
 */
export function isStepperValue(node: StepperExpression): boolean {
  switch (node.type) {
    case 'Literal':
    case 'ArrowFunctionExpression':
    case 'ArrayExpression':
      return true;
    case 'Identifier':
      return node.name === 'undefined';
    default:
      return false;
  }
}

/**
 * Extracts a representative JavaScript value from a fully-reduced stepper node,
 * suitable for passing to runtime type checking functions (checkBinaryExpression,
 * checkUnaryExpression).
 *
 * For Literal nodes, returns the actual literal value.
 * For non-Literal fully-reduced nodes (e.g., ArrowFunctionExpression, ArrayExpression,
 * undefined Identifier), returns a JS value of the corresponding type so that the
 * RTTC functions can produce the correct error message.
 *
 * Should only be called on nodes where `isStepperValue` returns `true`.
 */
export function getStepperNodeValue(node: StepperExpression): unknown {
  switch (node.type) {
    case 'Literal':
      return node.value;
    case 'ArrowFunctionExpression':
      // Return a dummy function so typeOf() returns 'function'
      return () => {};
    case 'ArrayExpression':
      // Return a dummy array so typeOf() returns 'array'
      return [];
    case 'Identifier':
      return undefined;
    default:
      return undefined;
  }
}
