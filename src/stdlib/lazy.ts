import { typeOf } from '../utils/typeOf'
import { Expression } from 'estree'
import { CallingNonFunctionValue, ExceptionError, InvalidNumberOfArguments } from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'

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

// Tag for functions in Abstract Syntax Tree
// of literal converted to Thunk.
// Used for methods value, toString.
export const astThunkNativeTag = 'Thunk-native-function'

// Tag for expressions in Abstract Syntax Tree
// that should not be lazily evaluated.
export const astEvalEagerTag = 'Required-eager-evaluation'

// String type for thunked lookup of names
export const identifierType = 'identifier'

// String type for thunked application of function
export const applicationType = 'application'

/**
 * (NOT a primitive function in Lazy Source)
 * Given any value, check if that value is a Thunk
 * that is used by the transpiler.
 *
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
 * (NOT a primitive function in Lazy Source)
 * Given a thunked expression, check if the expression
 * represents the lookup of some variable name.
 *
 * @param v The thunk to be checked.
 */
export function isThunkedIdentifier(v: TranspilerThunk<any>): boolean {
  return v.type === identifierType
}

/**
 * (NOT a primitive function in Lazy Source)
 * Given a thunked expression, check if the expression
 * represents the application of a function.
 *
 * @param v The thunk to be checked.
 */
export function isThunkedApplication(v: TranspilerThunk<any>): boolean {
  return v.type === applicationType
}

/**
 * A class representing an error where force receives
 * more arguments than expected.
 */
export class InvalidNumberOfArgumentsInForce {
  public expected: number
  public got: number
  public functionName: string

  constructor(expected: number, got: number, functionName: string) {
    this.expected = expected
    this.got = got
    this.functionName = functionName
  }
}

/**
 * Primitive function in Lazy Source.
 * Forces an expression to be evaluated until
 * a result is obtained.
 *
 * @param expression The expression to be evaluated.
 */
export function force(expression: any): any {
  // avoids multiple arguments given to force
  if (arguments.length !== force.length) {
    throw new InvalidNumberOfArgumentsInForce(force.length, arguments.length, nameOfForceFunction)
  }

  return evaluateLazyValue(expression)
}

// name of the force function, as "force" is a special
// function that needs to be recognised by the transpiler
export const nameOfForceFunction = force.name

/**
 * Primitive function in Lazy Source.
 * Forces an expression to be evaluated, but
 * only once (so the result may still be a thunk).
 *
 * @param expression The expression to be evaluated.
 */
export function force_once(expression: any) {
  // avoids multiple arguments given to force_once
  if (arguments.length !== force_once.length) {
    throw new InvalidNumberOfArgumentsInForce(
      force_once.length,
      arguments.length,
      nameOfForceOnceFunction
    )
  }

  return evaluateThunk(expression)
}

// name of the forceOnce function
export const nameOfForceOnceFunction = force_once.name

/**
 * (NOT a primitive function in Lazy Source)
 * Given a function name reference, check if this name
 * refers to an eagerly evaluated function in Lazy
 * Source (e.g. the function force is eagerly evaluated).
 *
 * @param name The function name as a string.
 */
export function functionShouldBeEagerlyEvaluated(name: string) {
  return name === nameOfForceFunction || name === nameOfForceOnceFunction
}

/**
 * (NOT a primitive function in Lazy Source)
 * Given a function name reference, check if this name
 * refers to a function that gives side-effects. Such
 * functions should be evaluated eagerly if located
 * on their own line, and not if they are passed as
 * arguments to another function.
 * @param name The function name as a string.
 */
export function callStatementShouldBeEagerlyEvaluated(name: string) {
  return name === 'display' || name === 'error'
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
 *
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
 *
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
    value: () => binaryFunc(evaluateLazyValue(t), evaluateLazyValue(u)),
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
 *
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
    value: () => unaryFunc(evaluateLazyValue(argument)),
    toString: () => stringRep,
    evaluated: false
  }
}

/**
 * Given a predicate, consequent and alternative
 * (lazy) expression, return the Thunk representing the
 * resulting conditional statement
 *
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
 *
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
 *
 * @param value The value to be evaluated.
 */
export function evaluateLazyValue(value: any): any {
  if (isTranspilerThunk(value)) {
    return evaluateLazyValue(evaluateThunk(value))
  } else {
    return value
  }
}

/**
 * Given a JavaScript function as well as thunked arguments,
 * create a Thunk that represents the result of applying
 * the function to the arguments.
 *
 * @param fun The function to be applied to the arguments.
 * @param args The array of thunked arguments to be evaluated
 *             by the function (if necessary).
 * @param dummyNode The node containing line and column
 *                  information of the expression, for throwing
 *                  runtime errors.
 * @param funStringRep The string representation of the function.
 *                     If not provided, will default to
 *                     "function".
 */
export function applyFunctionToThunks(
  // tslint:disable-next-line: ban-types
  fun: TranspilerThunk<any>,
  args: TranspilerThunk<any>[],
  dummyNode: Expression,
  funStringRep: string = 'function'
): TranspilerThunk<any> {
  const stringRep =
    funStringRep +
    '(' +
    (args.length === 0
      ? ''
      : args.reduce(
          (ta, tb, idx) => (idx === 0 ? ta + tb.toString() : ta + ', ' + tb.toString()),
          ''
        )) +
    ')'
  return {
    type: applicationType,
    value: () => {
      // evaluate possibly lazy value representing the function
      const originalFunction = evaluateThunk(fun)
      // originalFunction might not be a function!
      // (didn't have chance to check this at transpile time)
      if (typeof originalFunction === 'function') {
        if (originalFunction.transformedFunction === undefined) {
          try {
            return originalFunction(...args)
          } catch (error) {
            if (!(error instanceof RuntimeSourceError || error instanceof ExceptionError)) {
              throw new ExceptionError(error, dummyNode.loc!)
            } else {
              throw error
            }
          }
        } else {
          const expectedLength = originalFunction.transformedFunction.length
          const receivedLength = args.length
          if (expectedLength !== receivedLength) {
            throw new InvalidNumberOfArguments(dummyNode, expectedLength, receivedLength)
          }
          return originalFunction(...args)
        }
      } else {
        throw new CallingNonFunctionValue(originalFunction, dummyNode)
      }
    },
    toString: () => stringRep,
    evaluated: false
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
