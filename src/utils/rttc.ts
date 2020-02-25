import * as es from 'estree'
import { RuntimeSourceError } from '../interpreter-errors'
import { Thunk } from '../stdlib/lazy'
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

// Checks if a Thunk is a number
const isNumberT = (v: Thunk<Value>) => v.type === 'number'
// Checks if Thunk is a string
const isStringT = (v: Thunk<Value>) => v.type === 'string'

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
  left: Thunk<Value>,
  right: Thunk<Value>
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
