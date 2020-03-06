import { typeOf } from '../utils/typeOf'

/**
 * Type definitions for lazy evaluation, as well as
 * builtin functions for lazy evaluation
 */

// Primitive Thunk type
export interface Thunk<T> {
  // whether the Thunk has been previously evaluated
  evaluated: boolean
  // the string representation of this Thunk
  toString: () => string
  // return type of this Thunk
  type: string
  // the lambda that holds the logic for evaluation
  value: () => T
}

export type LazyNullary<R> = () => Thunk<R>

export type LazyUnary<T, R> = (x: Thunk<T>) => Thunk<R>

export type LazyBinary<T, U, R> = (x: Thunk<T>, y: Thunk<U>) => Thunk<R>

export type LazyTertiary<T, U, V, R> = (x: Thunk<T>, y: Thunk<U>, z: Thunk<V>) => Thunk<R>

// Tag for functions in Abstract Syntax Tree
// of literal converted to Thunk.
// Used for methods value, toString.
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
 * Thunks, to be used in the interpreter. Note that
 * this function is only to be used for primitive
 * values, hence the "evaluated" property is set to
 * "true", and no attempt will be made to memoize
 * the inner value of the Thunk.
 * @param value The primitive value.
 */
export function makeThunk<T>(value: T): Thunk<T> {
  return {
    type: typeOf(value),
    value: () => value,
    toString: () => value + '',
    evaluated: true
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
    toString: () => t.toString() + ' ' + operator + ' ' + u.toString(),
    evaluated: false
  }
}

/**
 * (NOT a primitive function in Lazy Source)
 * Makes a Thunk with a unary function and two
 * Thunks. The unary function passed into
 * makeThunkWithPrimitiveUnary is never executed
 * before the result Thunk is forced to evaluate.
 * @param argument Thunk containing an operand t with type T.
 * @param unaryFunc The function to apply to t.
 * @param returnType Type of R, as a string.
 * @param operator Operator represented by unaryFunc,
 *     but as a string (will be used in final string
 *     representation of the result thunk)
 */
export function makeThunkWithPrimitiveUnary<T, R>(
  argument: Thunk<T>,
  unaryFunc: (t: T) => R,
  returnType: string,
  operator: string
): Thunk<R> {
  return {
    type: returnType,
    value: () => unaryFunc(evaluateThunk(argument)),
    toString: () => operator + argument.toString(),
    evaluated: false
  }
}

/**
 * (NOT a primitive function in Lazy Source)
 * Gets the value of the Thunk by forcing its
 * evaluation. Part of the abstraction for
 * Thunks, to be used in the interpreter. This
 * function will also memoize the result, such
 * that future attempts to call the Thunk value
 * will not result in additional calculation.
 * @param value The thunk.
 */
export function evaluateThunk<T>(thunk: Thunk<T>): T {
  if (thunk.evaluated) {
    return thunk.value()
  } else {
    // calculate the desired value
    const finalValue = thunk.value()
    // memoize the calculated value
    thunk.value = () => finalValue
    // set the evaluated property to true
    thunk.evaluated = true
    return finalValue
  }
}

/**
 * Testcases
 */
/*
// Lazy Source syntax
const x = 1 + 1;
// this is translated into normal JS syntax:
// x is assigned to () => (() => { return 1; })() + (() => { return 1; })();

x; // nothing happens
force(x); // calculates expression, returns 2
force(x); // returns 2 from previous calculation
*/
/*
function add(x, y) { return x + y; } add(1 + 2, 3 + 4);
*/
