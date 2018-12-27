import * as es from 'estree'
import Closure from '../closure'
import { Context, ErrorSeverity, ErrorType, SourceError, Value } from '../types'

const LHS = ' on left hand side of operation'
const RHS = ' on right hand side of operation'

export class TypeError implements SourceError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR
  public location: es.SourceLocation

  constructor(node: es.Node, public side: string, public expected: string, public got: string) {
    this.location = node.loc!
  }

  public explain() {
    return `Expected ${this.expected}${this.side}, got ${this.got}.`
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
const isString = (v: Value) => typeOf(v) === 'string'
const isBool = (v: Value) => typeOf(v) === 'boolean'
const isObject = (v: Value) =>
  typeOf(v) === 'object' &&
  v !== null &&
  !(v instanceof Closure) &&
  !(v instanceof Function) &&
  !Array.isArray(v)
const isArray = (v: Value) => Array.isArray(v)

export const checkUnaryExpression = (
  context: Context,
  operator: es.UnaryOperator,
  value: Value
) => {
  const node = context.runtime.nodes[0]
  if ((operator === '+' || operator === '-') && !isNumber(value)) {
    return new TypeError(node, '', 'number', typeOf(value))
  } else if (operator === '!' && !isBool(value)) {
    return new TypeError(node, '', 'boolean', typeOf(value))
  } else {
    return undefined
  }
}

export const checkBinaryExpression = (
  context: Context,
  operator: es.BinaryOperator,
  left: Value,
  right: Value
) => {
  const node = context.runtime.nodes[0]
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

export const checkIfStatement = (context: Context, test: Value) => {
  const node = context.runtime.nodes[0]
  return isBool(test) ? undefined : new TypeError(node, ' as condition', 'boolean', typeOf(test))
}

export const checkMemberAccess = (context: Context, obj: Value, prop: Value) => {
  const node = context.runtime.nodes[0]
  if (isObject(obj)) {
    return isString(prop) ? undefined : new TypeError(node, ' as prop', 'string', typeOf(prop))
  } else if (isArray(obj)) {
    return isNumber(prop) ? undefined : new TypeError(node, ' as prop', 'number', typeOf(prop))
  } else {
    return new TypeError(node, '', 'object or array', typeOf(obj))
  }
}
