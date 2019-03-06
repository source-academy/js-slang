import { BinaryOperator, UnaryOperator } from 'estree'
import { JSSLANG_PROPERTIES } from '../constants'
import { CallingNonFunctionValue, InvalidNumberOfArguments } from '../interpreter-errors'
import { PotentialInfiniteLoopError } from '../native-errors'
import * as create from './astCreator'
import * as rttc from './rttc'

export function throwIfExceedsTimeLimit(
  start: number,
  current: number,
  line: number,
  column: number
) {
  if (current - start > JSSLANG_PROPERTIES.maxExecTime) {
    throw new PotentialInfiniteLoopError(create.locationDummyNode(line, column))
  }
}

export function callIfFunctionAndRightArgumentsElseError(
  candidate: any,
  line: number,
  column: number,
  ...args: any[]
) {
  const dummy = create.callExpression(create.locationDummyNode(line, column), args, {
    start: { line, column },
    end: { line, column }
  })
  if (typeof candidate === 'function') {
    if (candidate.transformedFunction !== undefined) {
      const expectedLength = candidate.transformedFunction.length
      const receivedLength = args.length
      if (expectedLength !== receivedLength) {
        throw new InvalidNumberOfArguments(dummy, expectedLength, receivedLength)
      }
    }
    return candidate(...args)
  } else {
    throw new CallingNonFunctionValue(candidate, dummy)
  }
}

export function itselfIfBooleanElseError(candidate: any, line: number, column: number) {
  const error = rttc.checkIfStatement(create.locationDummyNode(line, column), candidate)
  if (error === undefined) {
    return candidate
  } else {
    throw error
  }
}

export function evaluateUnaryExpressionIfValidElseError(
  operator: UnaryOperator,
  argument: any,
  line: number,
  column: number
) {
  const error = rttc.checkUnaryExpression(
    create.locationDummyNode(line, column),
    operator,
    argument
  )
  if (error === undefined) {
    return evaluateUnaryExpression(operator, argument)
  } else {
    throw error
  }
}

export function evaluateUnaryExpression(operator: UnaryOperator, value: any) {
  if (operator === '!') {
    return !value
  } else if (operator === '-') {
    return -value
  } else {
    return +value
  }
}

export function evaluateBinaryExpressionIfValidElseError(
  operator: BinaryOperator,
  left: any,
  right: any,
  line: number,
  column: number
) {
  const error = rttc.checkBinaryExpression(
    create.locationDummyNode(line, column),
    operator,
    left,
    right
  )
  if (error === undefined) {
    return evaluateBinaryExpression(operator, left, right)
  } else {
    throw error
  }
}

export function evaluateBinaryExpression(operator: BinaryOperator, left: any, right: any) {
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
