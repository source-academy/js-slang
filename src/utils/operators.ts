import { BinaryOperator, UnaryOperator } from 'estree'
import { JSSLANG_PROPERTIES } from '../constants'
import {
  CallingNonFunctionValue,
  ExceptionError,
  GetInheritedPropertyError,
  InvalidNumberOfArguments
} from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import {
  PotentialInfiniteLoopError,
  PotentialInfiniteRecursionError
} from '../errors/timeoutErrors'
import { callExpression, locationDummyNode } from './astCreator'
import * as create from './astCreator'
import * as rttc from './rttc'

export function throwIfTimeout(start: number, current: number, line: number, column: number) {
  if (current - start > JSSLANG_PROPERTIES.maxExecTime) {
    throw new PotentialInfiniteLoopError(create.locationDummyNode(line, column))
  }
}

export function callIfFuncAndRightArgs(
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
    if (candidate.transformedFunction === undefined) {
      try {
        return candidate(...args)
      } catch (error) {
        // if we already handled the error, simply pass it on
        if (!(error instanceof RuntimeSourceError || error instanceof ExceptionError)) {
          throw new ExceptionError(error, dummy.loc!)
        } else {
          throw error
        }
      }
    } else {
      const expectedLength = candidate.transformedFunction.length
      const receivedLength = args.length
      if (expectedLength !== receivedLength) {
        throw new InvalidNumberOfArguments(dummy, expectedLength, receivedLength)
      }
      return candidate(...args)
    }
  } else {
    throw new CallingNonFunctionValue(candidate, dummy)
  }
}

export function boolOrErr(candidate: any, line: number, column: number) {
  const error = rttc.checkIfStatement(create.locationDummyNode(line, column), candidate)
  if (error === undefined) {
    return candidate
  } else {
    throw error
  }
}

export function unaryOp(operator: UnaryOperator, argument: any, line: number, column: number) {
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

export function binaryOp(
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

/**
 * Limitations for current properTailCalls implementation:
 * Obviously, if objects ({}) are reintroduced,
 * we have to change this for a more stringent check,
 * as isTail and transformedFunctions are properties
 * and may be added by Source code.
 */
export const callIteratively = (f: any, ...args: any[]) => {
  let line = -1
  let column = -1
  const MAX_TIME = JSSLANG_PROPERTIES.maxExecTime
  const startTime = Date.now()
  const pastCalls: [string, any[]][] = []
  while (true) {
    const dummy = locationDummyNode(line, column)
    if (Date.now() - startTime > MAX_TIME) {
      throw new PotentialInfiniteRecursionError(dummy, pastCalls)
    } else if (typeof f !== 'function') {
      throw new CallingNonFunctionValue(f, dummy)
    }
    if (f.transformedFunction! !== undefined) {
      f = f.transformedFunction
      const expectedLength = f.length
      const receivedLength = args.length
      if (expectedLength !== receivedLength) {
        throw new InvalidNumberOfArguments(
          callExpression(locationDummyNode(line, column), args, {
            start: { line, column },
            end: { line, column }
          }),
          expectedLength,
          receivedLength
        )
      }
    }
    let res
    try {
      res = f(...args)
    } catch (error) {
      // if we already handled the error, simply pass it on
      if (!(error instanceof RuntimeSourceError || error instanceof ExceptionError)) {
        throw new ExceptionError(error, dummy.loc!)
      } else {
        throw error
      }
    }
    if (res === null || res === undefined) {
      return res
    } else if (res.isTail === true) {
      f = res.function
      args = res.arguments
      line = res.line
      column = res.column
      pastCalls.push([res.functionName, args])
    } else if (res.isTail === false) {
      return res.value
    } else {
      return res
    }
  }
}

export const wrap = (f: (...args: any[]) => any, stringified: string) => {
  const wrapped = (...args: any[]) => callIteratively(f, ...args)
  wrapped.transformedFunction = f
  wrapped[Symbol.toStringTag] = () => stringified
  wrapped.toString = () => stringified
  return wrapped
}

export const setProp = (obj: any, prop: any, value: any, line: number, column: number) => {
  const dummy = locationDummyNode(line, column)
  const error = rttc.checkMemberAccess(dummy, obj, prop)
  if (error === undefined) {
    return (obj[prop] = value)
  } else {
    throw error
  }
}

export const getProp = (obj: any, prop: any, line: number, column: number) => {
  const dummy = locationDummyNode(line, column)
  const error = rttc.checkMemberAccess(dummy, obj, prop)
  if (error === undefined) {
    if (obj[prop] !== undefined && !obj.hasOwnProperty(prop)) {
      throw new GetInheritedPropertyError(dummy, obj, prop)
    } else {
      return obj[prop]
    }
  } else {
    throw error
  }
}
