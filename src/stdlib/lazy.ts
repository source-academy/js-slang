import { typeOf } from '../utils/typeOf'
import { List, Pair } from './list'

/**
 * Type definitions for lazy evaluation, as well as
 * builtin functions for lazy evaluation
 */

// Primitive Thunk type
export interface TranspilerThunk<T> {
  // whether the Thunk has been previously evaluated
  evaluated: boolean
  // the string representation of this Thunk
  toString: () => string
  // return type of this Thunk
  type: string
  // the lambda that holds the logic for evaluation
  value: () => T
}

type PrimitiveEv = boolean | number | string | undefined | null
// tslint:disable-next-line: ban-types
type FunctionsEv = PrimitiveEv | Function
// Types of Expressible Values in Lazy Source 2
type ExpressibleValues = FunctionsEv | Pair<any, any> | List

// Tag for functions in Abstract Syntax Tree
// of literal converted to Thunk.
// Used for methods value, toString.
export const astThunkNativeTag = 'Thunk-native-function'

/**
 * Given any value, check if that value is a Thunk
 * that is used by the transpiler.
 * @param v The value to be checked.
 * @returns True, if the value is a Thunk. False,
 *     if the value is another kind of value.
 */
export function isTranspilerThunk(v: any): boolean {
  return (
    v !== null &&
    v !== undefined &&
    typeof v === 'object' &&
    Object.keys(v).length === 4 && // check for exactly 4 properties
    v.evaluated !== undefined &&
    typeof v.evaluated === 'boolean' &&
    v.toString !== undefined &&
    typeof v.toString === 'function' &&
    v.type !== undefined &&
    typeof v.type === 'string' &&
    v.value !== undefined &&
    typeof v.value === 'function'
  )
}

/**
 * Primitive function in Lazy Source.
 * Forces an expression to be evaluated until
 * a result is obtained.
 * @param expression The expression to be evaluated.
 */
export function force(expression: any) {
  return evaluateLazyValue(expression)
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
export function makeThunk<T>(value: T): TranspilerThunk<T> {
  const stringRep = value + ''
  return {
    type: typeOf(value),
    value: () => value,
    toString: () => stringRep,
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
  t: TranspilerThunk<T>,
  u: TranspilerThunk<U>,
  binaryFunc: (t: T, u: U) => R,
  returnType: string,
  operator: string
): TranspilerThunk<R> {
  const stringRep = t.toString() + ' ' + operator + ' ' + u.toString()
  return {
    type: returnType,
    value: () => binaryFunc(evaluateThunk(t), evaluateThunk(u)),
    toString: () => stringRep,
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
  argument: TranspilerThunk<T>,
  unaryFunc: (t: T) => R,
  returnType: string,
  operator: string
): TranspilerThunk<R> {
  const stringRep = operator + argument.toString()
  return {
    type: returnType,
    value: () => unaryFunc(evaluateThunk(argument)),
    toString: () => stringRep,
    evaluated: false
  }
}

/**
 * Given a predicate, consequent and alternative
 * (lazy) expression, return the Thunk representing the
 * resulting conditional statement
 * @param predicate The predicate to be evaluated
 * @param consequent The consequent expression, to be
 *     evaluated only if 'predicate' evaluates to 'true'
 * @param alternative The alternative expression, to be
 *     evaluated only if 'predicate' evaluates to 'false'
 * @param stringRepresentation String representation of
 *     the operator and its operands (used for && and
 *     || operators). If not provided, the string
 *     representation will use the normal
 *     conditional statement syntax
 *     'predicate ? consequent : alternative'
 */
export function makeConditionalThunk<T>(
  predicate: TranspilerThunk<boolean>,
  consequent: TranspilerThunk<T>,
  alternative: TranspilerThunk<T>,
  stringRepresentation?: string
): TranspilerThunk<T> {
  const stringRep =
    stringRepresentation ||
    predicate.toString() + ' ? ' + consequent.toString() + ' : ' + alternative.toString()
  return {
    // assume consequent.type === alternative.type
    type: consequent.type,
    value: () => {
      const evaluatePredicate = evaluateThunk(predicate)
      if (evaluatePredicate) {
        return evaluateThunk(consequent)
      } else {
        return evaluateThunk(alternative)
      }
    },
    toString: () => stringRep,
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
export function evaluateThunk<T>(thunk: TranspilerThunk<T>): T {
  if (thunk.evaluated) {
    return thunk.value()
  } else {
    // calculate the desired value
    const finalValue = thunk.value()
    // eagerly create the string representation of the thunk
    const finalString = finalValue + ''
    // memoize the calculated value
    thunk.value = () => finalValue
    // set the new string representation of the thunk
    thunk.toString = () => finalString
    // set the evaluated property to true
    thunk.evaluated = true
    return finalValue
  }
}

/**
 * (NOT a primitive function in Lazy Source)
 * Evaluates any value (inclusive of Thunk expressions)
 * recursively, only stopping when a primitive value type
 * that can be the result of evaluation of the program
 * (i.e. an expressible value) is obtained.
 * @param value The value to be evaluated.
 */
export function evaluateLazyValue(value: any): ExpressibleValues {
  if (isTranspilerThunk(value)) {
    return evaluateLazyValue(evaluateThunk(value))
  } else {
    return value
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
