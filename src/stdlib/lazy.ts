import { typeOf } from '../utils/typeOf'

/**
 * Type definitions for lazy evaluation, as well as
 * builtin functions for lazy evaluation
 */

// Primitive Thunk type
export interface Thunk<T> {
  type: string
  value: () => T
  toString: () => string
}

export type LazyNullary<R> = () => Thunk<R>

export type LazyUnary<T, R> = (x: Thunk<T>) => Thunk<R>

export type LazyBinary<T, U, R> = (x: Thunk<T>, y: Thunk<U>) => Thunk<R>

export type LazyTertiary<T, U, V, R> = (x: Thunk<T>, y: Thunk<U>, z: Thunk<V>) => Thunk<R>

// tag for functions in Abstract Syntax Tree
// of literal converted to Thunk
export const astThunkNativeTag = 'Thunk-native-function'

/**
 * Primitive function in Lazy Source.
 * Forces an expression to be evaluated until
 * a result is obtained.
 * @param expression The expression to be evaluated.
 */
export function force<T>(expression: Thunk<T>) {
  return evaluateThunk(expression)
}

/**
 * (NOT a primitive function in Lazy Source)
 * Makes a primitive value into a Thunk. Should not
 * be used on Thunks! Part of the abstraction for
 * Thunks, to be used in the interpreter.
 * @param value The primitive value.
 */
export function makeThunk<T>(value: T): Thunk<T> {
  return {
    type: typeOf(value),
    value: () => value,
    toString: () => value + ''
  }
}

/**
 * (NOT a primitive function in Lazy Source)
 * Makes a Thunk with a binary function and two
 * Thunks. The binary function is never executed
 * before the result Thunk is forced.
 * @param t Thunk containing an operand t of type T.
 * @param u Thunk containing an operand u of type U.
 * @param binaryFunc The function to apply to t and u.
 * @param returnType Type of R, as a string.
 * @param operator Operator represented by binaryFunc,
 *     but as a string (will be used in final string
 *     representation of the result thunk)
 */
export function makeThunkWithPrimitiveBinary<T, U, R>(
  t: Thunk<T>,
  u: Thunk<U>,
  binaryFunc: (t: T, u: U) => R,
  returnType: string,
  operator: string
): Thunk<R> {
  return {
    type: returnType,
    value: () => binaryFunc(evaluateThunk(t), evaluateThunk(u)),
    toString: () => t.toString() + ' ' + operator + ' ' + u.toString()
  }
}

/**
 * (NOT a primitive function in Lazy Source)
 * Gets the value of the Thunk by forcing its
 * evaluation. Part of the abstraction for
 * Thunks, to be used in the interpreter.
 * @param value The thunk.
 */
export function evaluateThunk<T>(thunk: Thunk<T>): T {
  return thunk.value()
}

/**
 * Testcases
 */
/*
// Lazy Source syntax
const x = 1 + 1;
// this is translated into normal JS syntax:
// x is assigned to () => () => { return 1; }() + () => { return 1; }();

x; // nothing happens
force(x); // calculates expression, returns 2
force(x); // returns 2 from previous calculation
*/
/*
function add(x, y) { return x + y; } add(1 + 2, 3 + 4);
*/
