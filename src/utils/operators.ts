import { CallingNonFunctionValue, InvalidNumberOfArguments } from '../interpreter-errors'
import { Value } from '../types'
import * as create from './astCreator'
import * as rttc from './rttc'

export function callIfFunctionAndRightArgumentsElseError(
  candidate: any,
  line: number,
  column: number,
  ...args: any[]
) {
  const dummy = create.locationDummyNode(line, column)
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

export function evaluateBinaryExpression(operator: string, left: Value, right: Value) {
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
