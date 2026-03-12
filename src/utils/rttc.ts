import type es from 'estree'
import { RuntimeSourceError } from '../errors/base'
import { Chapter } from '../langs'
import type { Node, Value } from '../types'

const LHS = ' on left hand side of operation'
const RHS = ' on right hand side of operation'

export class RuntimeTypeError extends RuntimeSourceError<Node> {
  constructor(
    node: Node,
    public readonly side: string,
    public readonly expected: string,
    public readonly got: string,
    public readonly chapter: Chapter = Chapter.SOURCE_4
  ) {
    super(node)
  }

  public override explain() {
    const displayGot =
      this.got === 'array' ? (this.chapter <= 2 ? 'pair' : 'compound data') : this.got
    return `Expected ${this.expected}${this.side}, got ${displayGot}.`
  }

  public override elaborate() {
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
const isArrayIndex = (v: Value) => isNumber(v) && v >>> 0 === v && v < 2 ** 32 - 1
const isString = (v: Value) => typeOf(v) === 'string'
const isBool = (v: Value) => typeOf(v) === 'boolean'
const isObject = (v: Value) => typeOf(v) === 'object'
const isArray = (v: Value) => typeOf(v) === 'array'

export function checkUnaryExpression(
  node: Node,
  operator: '!',
  value: unknown,
  chapter?: Chapter
): asserts value is boolean
export function checkUnaryExpression(
  node: Node,
  operator: '-' | '+',
  value: unknown,
  chapter?: Chapter
): asserts value is number
export function checkUnaryExpression(
  node: Node,
  operator: es.UnaryOperator,
  value: unknown,
  chapter?: Chapter
): asserts value is number | boolean
export function checkUnaryExpression(
  node: Node,
  operator: es.UnaryOperator,
  value: unknown,
  chapter: Chapter = Chapter.SOURCE_4
) {
  if ((operator === '+' || operator === '-') && !isNumber(value)) {
    throw new RuntimeTypeError(node, '', 'number', typeOf(value), chapter)
  } else if (operator === '!' && !isBool(value)) {
    throw new RuntimeTypeError(node, '', 'boolean', typeOf(value), chapter)
  }
}

export function checkBinaryExpression(
  node: Node,
  operator: '+',
  chapter: Chapter,
  values: [unknown, unknown]
): asserts values is [string, string] | [number, number]
export function checkBinaryExpression(
  node: Node,
  operator: '-' | '*' | '/' | '<' | '<=' | '>' | '>=' | '%',
  chapter: Chapter,
  values: [unknown, unknown]
): asserts values is [number, number]
export function checkBinaryExpression(
  node: Node,
  operator: '===' | '!==',
  chapter: Chapter.SOURCE_1 | Chapter.SOURCE_2,
  values: [unknown, unknown]
): asserts values is [string, string] | [number, number]
export function checkBinaryExpression<T>(
  node: Node,
  operator: '===' | '!==',
  chapter: Exclude<Chapter, Chapter.SOURCE_1 | Chapter.SOURCE_2>,
  values: [unknown, unknown]
): asserts values is [T, T]
export function checkBinaryExpression(
  node: Node,
  operator: es.BinaryOperator,
  chapter: Chapter,
  values: [unknown, unknown]
): asserts values is [any, any]
export function checkBinaryExpression(
  node: Node,
  operator: es.BinaryOperator,
  chapter: Chapter,
  [left, right]: [unknown, unknown]
) {
  switch (operator) {
    case '-':
    case '*':
    case '/':
    case '%': {
      if (!isNumber(left)) {
        throw new RuntimeTypeError(node, LHS, 'number', typeOf(left), chapter)
      } else if (!isNumber(right)) {
        throw new RuntimeTypeError(node, RHS, 'number', typeOf(right), chapter)
      } else {
        return
      }
    }
    case '+':
    case '<':
    case '<=':
    case '>':
    case '>=':
    case '!==':
    case '===': {
      if (chapter > 2 && (operator === '===' || operator === '!==')) {
        return
      }
      if (isNumber(left)) {
        if (!isNumber(right))
          throw new RuntimeTypeError(node, RHS, 'number', typeOf(right), chapter)
      } else if (isString(left)) {
        if (!isString(right))
          throw new RuntimeTypeError(node, RHS, 'string', typeOf(right), chapter)
      } else {
        throw new RuntimeTypeError(node, LHS, 'string or number', typeOf(left), chapter)
      }
      return
    }
    default:
      return
  }
}

export function checkIfStatement(
  node: Node,
  test: unknown,
  chapter: Chapter = Chapter.SOURCE_4
): asserts test is boolean {
  if (!isBool(test)) {
    throw new RuntimeTypeError(node, ' as condition', 'boolean', typeOf(test), chapter)
  }
}

const MAX_SOURCE_ARRAY_INDEX = 4294967295
export const checkoutofRange = (node: Node, index: Value, chapter: Chapter = Chapter.SOURCE_4) => {
  return index >= 0 && index <= MAX_SOURCE_ARRAY_INDEX // as per Source 3 spec
    ? undefined
    : new RuntimeTypeError(node, ' in reasonable range', 'index', 'out of range', chapter)
}

export const checkMemberAccess = (node: Node, obj: Value, prop: Value) => {
  if (isObject(obj)) {
    return isString(prop)
      ? undefined
      : new RuntimeTypeError(node, ' as prop', 'string', typeOf(prop))
  } else if (isArray(obj)) {
    return isArrayIndex(prop)
      ? undefined
      : isNumber(prop)
        ? new RuntimeTypeError(node, ' as prop', 'array index', 'other number')
        : new RuntimeTypeError(node, ' as prop', 'array index', typeOf(prop))
  } else {
    return new RuntimeTypeError(node, '', 'object or array', typeOf(obj))
  }
}

export const isIdentifier = (node: any): node is es.Identifier => {
  return (node as es.Identifier).name !== undefined
}

export const checkArray = (node: Node, maybeArray: Value, chapter: Chapter = Chapter.SOURCE_4) => {
  return isArray(maybeArray)
    ? undefined
    : new RuntimeTypeError(node, '', 'array', typeOf(maybeArray), chapter)
}
