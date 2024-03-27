// just examples without throwing any exception
import { BinaryOperator, UnaryOperator } from 'estree'

import { ReservedParam } from './types'
import { toStringWGSL } from './utils'

/**
 * This function evaluates the binary expressions during both normal evaluation
 * or a WGSL transpiling process.
 */
export function evaluateBinaryExpression(operator: BinaryOperator, left: any, right: any) {
  if (left instanceof ReservedParam || right instanceof ReservedParam) {
    return new ReservedParam('(' + toStringWGSL(left) + operator + toStringWGSL(right) + ')')
  }
  switch (operator) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '*':
      return left * right
    case '/':
      return left / right
    case '%':
      return left % right
    case '===':
      return left === right
    case '!==':
      return left !== right
    case '<=':
      return left <= right
    case '<':
      return left < right
    case '>':
      return left > right
    case '>=':
      return left >= right
    default:
      return undefined
  }
}

/**
 * This function evaluates the unary expressions during both normal evaluation
 * or a WGSL transpiling process.
 */
export function evaluateUnaryExpression(operator: UnaryOperator, value: any) {
  if (value instanceof ReservedParam) {
    return new ReservedParam(operator + '(' + value.value + ')')
  }
  if (operator === '!') {
    return !value
  } else if (operator === '-') {
    return -value
  } else if (operator === 'typeof') {
    return typeof value
  } else {
    return +value
  }
}

/**
 * This function is used to transpile a built-in function call to WGSL.
 */
export function applySpecial(functionName: string, args: any[]) {
  let str: string = functionName + '('
  for (let index = 0; index < args.length - 1; index++) {
    str += toStringWGSL(args[index]) + ','
  }
  str += args[args.length - 1] + ')'
  return new ReservedParam(str)
}
