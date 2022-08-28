import * as es from 'estree'

import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { Chapter, ErrorSeverity, ErrorType, Value } from '../types'

const LHS = ' on left hand side of operation'
const RHS = ' on right hand side of operation'

export class TypeError extends RuntimeSourceError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR
  public location: es.SourceLocation

  constructor(
    node: es.Node,
    public side: string,
    public expected: string,
    public got: string,
    public chapter: Chapter = Chapter.SOURCE_4
  ) {
    super(node)
  }

  public explain() {
    const displayGot =
      this.got === 'array' ? (this.chapter <= 2 ? 'pair' : 'compound data') : this.got
    return `Expected ${this.expected}${this.side}, got ${displayGot}.`
  }

  public elaborate() {
    return this.explain()
  }
}

// We need to define our own typeof in order for null/array to display properly in error messages
const typeOf = (v: Value) => {
  if (v === null) {
    return 'null'
  } else if (Array.isArray(v)) {
    return 'array'
  } else {
    return typeof v
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

export const checkUnaryExpression = (
  node: es.Node,
  operator: es.UnaryOperator,
  value: Value,
  chapter: Chapter = Chapter.SOURCE_4
) => {
  if ((operator === '+' || operator === '-') && !isNumber(value)) {
    return new TypeError(node, '', 'number', typeOf(value), chapter)
  } else if (operator === '!' && !isBool(value)) {
    return new TypeError(node, '', 'boolean', typeOf(value), chapter)
  } else {
    return undefined
  }
}

export const checkBinaryExpression = (
  node: es.Node,
  operator: es.BinaryOperator,
  chapter: Chapter,
  left: Value,
  right: Value
) => {
  switch (operator) {
    case '-':
    case '*':
    case '/':
    case '%':
      if (!isNumber(left)) {
        return new TypeError(node, LHS, 'number', typeOf(left), chapter)
      } else if (!isNumber(right)) {
        return new TypeError(node, RHS, 'number', typeOf(right), chapter)
      } else {
        return
      }
    case '+':
    case '<':
    case '<=':
    case '>':
    case '>=':
    case '!==':
    case '===':
      if (chapter > 2 && (operator === '===' || operator === '!==')) {
        return
      }
      if (isNumber(left)) {
        return isNumber(right)
          ? undefined
          : new TypeError(node, RHS, 'number', typeOf(right), chapter)
      } else if (isString(left)) {
        return isString(right)
          ? undefined
          : new TypeError(node, RHS, 'string', typeOf(right), chapter)
      } else {
        return new TypeError(node, LHS, 'string or number', typeOf(left), chapter)
      }
    default:
      return
  }
}

export const checkIfStatement = (
  node: es.Node,
  test: Value,
  chapter: Chapter = Chapter.SOURCE_4
) => {
  return isBool(test)
    ? undefined
    : new TypeError(node, ' as condition', 'boolean', typeOf(test), chapter)
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

export const isIdentifier = (node: any): node is es.Identifier => {
  return (node as es.Identifier).name !== undefined
}
