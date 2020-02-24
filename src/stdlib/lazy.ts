/**
 * Type definitions for lazy evaluation, as well as
 * builtin functions for lazy evaluation
 */

export type Thunk<T> = () => T;

export type LazyNullary<R> = () => Thunk<R>;

export type LazyUnary<T, R> = (x: Thunk<T>) => Thunk<R>;

export type LazyBinary<T, U, R> = (x: Thunk<T>, y: Thunk<U>) => Thunk<R>;

export type LazyTertiary<T, U, V, R> =
  (x: Thunk<T>, y: Thunk<U>, z: Thunk<V>) => Thunk<R>;

/**
 * Forces an expression to be evaluated until
 * a result is obtained.
 * 
 * @param expression The expression to be evaluated.
 */
export function force<T>(expression: Thunk<T>) {
  return expression();
}

/**
 * Makes a primitive value into a Thunk. Should not
 * be used on Thunks!
 * 
 * @param value The primitive value.
 */
export function makeThunk<T>(value: T) {
  return () => value;
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
