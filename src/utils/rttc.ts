import * as es from 'estree'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { TranspilerThunk, isKnownThunkType } from '../stdlib/lazy'
import { ErrorSeverity, ErrorType, Value } from '../types'
import { typeOf } from './typeOf'

const LHS = ' on left hand side of operation'
const RHS = ' on right hand side of operation'

export class TypeError extends RuntimeSourceError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR
  public location: es.SourceLocation

  constructor(node: es.Node, public side: string, public expected: string, public got: string) {
    super(node)
  }

  public explain() {
    return `Expected ${this.expected}${this.side}, got ${this.got}.`
  }

  public elaborate() {
    return this.explain()
  }
}

const isNumber = (v: Value) => typeOf(v) === 'number'
// See section 4 of https://2ality.com/2012/12/arrays.html
// v >>> 0 === v checks that v is a valid unsigned 32-bit int
// tslint:disable-next-line:no-bitwise
const isArrayIndex = (v: Value) => isNumber(v) && v >>> 0 === v && v < 2 ** 32 - 1
const isString = (v: Value) => typeOf(v) === 'string'
const isBool = (v: Value) => typeOf(v) === 'boolean'
const isObject = (v: Value) => typeOf(v) === 'object'
const isArray = (v: Value) => typeOf(v) === 'array'

export const checkUnaryExpression = (node: es.Node, operator: es.UnaryOperator, value: Value) => {
  if ((operator === '+' || operator === '-') && !isNumber(value)) {
    return new TypeError(node, '', 'number', typeOf(value))
  } else if (operator === '!' && !isBool(value)) {
    return new TypeError(node, '', 'boolean', typeOf(value))
  } else {
    return undefined
  }
}

export const checkBinaryExpression = (
  node: es.Node,
  operator: es.BinaryOperator,
  left: Value,
  right: Value
) => {
  switch (operator) {
    case '-':
    case '*':
    case '/':
    case '%':
      if (!isNumber(left)) {
        return new TypeError(node, LHS, 'number', typeOf(left))
      } else if (!isNumber(right)) {
        return new TypeError(node, RHS, 'number', typeOf(right))
      } else {
        return
      }
    case '+':
    case '<':
    case '<=':
    case '>':
    case '>=':
      if (isNumber(left)) {
        return isNumber(right) ? undefined : new TypeError(node, RHS, 'number', typeOf(right))
      } else if (isString(left)) {
        return isString(right) ? undefined : new TypeError(node, RHS, 'string', typeOf(right))
      } else {
        return new TypeError(node, LHS, 'string or number', typeOf(left))
      }
    case '!==':
    case '===':
    default:
      return
  }
}

export const checkIfStatement = (node: es.Node, test: Value) => {
  return isBool(test) ? undefined : new TypeError(node, ' as condition', 'boolean', typeOf(test))
}

export const checkMemberAccess = (node: es.Node, obj: Value, prop: Value) => {
  if (isObject(obj)) {
    return isString(prop) ? undefined : new TypeError(node, ' as prop', 'string', typeOf(prop))
  } else if (isArray(obj)) {
    return isArrayIndex(prop)
      ? undefined
      : isNumber(prop)
      ? new TypeError(node, ' as prop', 'array index', 'other number')
      : new TypeError(node, ' as prop', 'array index', typeOf(prop))
  } else {
    return new TypeError(node, '', 'object or array', typeOf(obj))
  }
}

// ====================================================
//  Runtime Type Checking for Lazy Evaluation (Thunks)
// ====================================================

/**
 * Checks if a Thunk is a number, if the type is known.
 * If the type is unknown at this time, assumes correct type.
 * @param v The Thunk to be checked
 */
const isNumberT = (v: TranspilerThunk<Value>) => (isKnownThunkType(v) ? v.type === 'number' : true)
/**
 * Checks if a Thunk is a string, if the type is known.
 * If the thunk is unknown at this time, assumes correct type.
 * @param v The Thunk to be checked
 */
const isStringT = (v: TranspilerThunk<Value>) => (isKnownThunkType(v) ? v.type === 'string' : true)

/**
 * Checks if a Thunk is a boolean, if the type is known.
 * If the thunk is unknown at this time, assumes correct type.
 * @param v The Thunk to be checked
 */
const isBoolT = (v: TranspilerThunk<Value>) => (isKnownThunkType(v) ? v.type === 'boolean' : true)

/**
 * Checks if a Thunk is a function, if the type is known.
 * If the thunk is unknown at this time, assumes correct type.
 * @param v The Thunk to be checked
 */
export const isFunctionT = (v: TranspilerThunk<Value>) =>
  isKnownThunkType(v) ? v.type === 'function' : true

/**
 * Checks that an unary expression has a correctly
 * typed Thunk as its argument, and returns the
 * type of the resultant Thunk (in string)
 * @param node The node representing location of the value
 * @param operator String representation of unary operator
 * @param value The value to be checked (Thunk)
 */
export const checkUnaryExpressionT = (
  node: es.Node,
  operator: es.UnaryOperator,
  value: TranspilerThunk<Value>
) => {
  switch (operator) {
    case '+':
    case '-':
      if (!isNumberT(value)) {
        return new TypeError(node, '', 'number', value.type)
      } else {
        return 'number'
      }
    case '!':
      if (!isBoolT(value)) {
        return new TypeError(node, '', 'boolean', value.type)
      } else {
        return 'boolean'
      }
    default:
      return ''
  }
}

/**
 * Checks that a binary expression has correctly
 * typed Thunks as arguments, and returns the
 * type of the resultant Thunk (in string)
 * @param node The node representing location of the value
 * @param operator The string representation of the binary
 *                 operator used
 * @param left The left value to be checked (Thunk)
 * @param right The right value to be checked (Thunk)
 */
export const checkBinaryExpressionT = (
  node: es.Node,
  operator: es.BinaryOperator,
  left: TranspilerThunk<Value>,
  right: TranspilerThunk<Value>
) => {
  switch (operator) {
    case '-':
    case '*':
    case '/':
    case '%':
      if (!isNumberT(left)) {
        return new TypeError(node, LHS, 'number', left.type)
      } else if (!isNumberT(right)) {
        return new TypeError(node, RHS, 'number', right.type)
      } else {
        return 'number'
      }
    case '+':
      if (isNumberT(left)) {
        if (isNumberT(right)) {
          return 'number'
        } else {
          return new TypeError(node, RHS, 'number', right.type)
        }
      } else if (isStringT(left)) {
        if (isStringT(right)) {
          return 'string'
        } else {
          return new TypeError(node, RHS, 'string', right.type)
        }
      } else {
        return new TypeError(node, LHS, 'string or number', left.type)
      }
    case '<':
    case '<=':
    case '>':
    case '>=':
      if (isNumberT(left)) {
        if (isNumberT(right)) {
          return 'boolean'
        } else {
          return new TypeError(node, RHS, 'number', right.type)
        }
      } else if (isStringT(left)) {
        if (isStringT(right)) {
          return 'boolean'
        } else {
          return new TypeError(node, RHS, 'string', right.type)
        }
      } else {
        return new TypeError(node, LHS, 'string or number', left.type)
      }
    case '!==':
    case '===':
      return 'boolean'
    default:
      // unknown type, may still be valid due to conditionals
      return ''
  }
}

/**
 * Given a Thunk expression, checks whether this Thunk
 * expression is of type boolean (and throws an
 * TypeError if it is not)
 * @param node The node representing location of the value
 * @param test The value to be tested (Thunk)
 */
export const checkIfStatementT = (node: es.Node, test: TranspilerThunk<Value>) => {
  return isBoolT(test) ? undefined : new TypeError(node, ' as condition', 'boolean', test.type)
}
