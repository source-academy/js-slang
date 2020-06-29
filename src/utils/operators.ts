import { BinaryOperator, UnaryOperator } from 'estree'
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
import { LazyBuiltIn } from '../createContext'

export function throwIfTimeout(maxExecTime: number, start: number, current: number, line: number, column: number) {
  if (current - start > maxExecTime) {
    throw new PotentialInfiniteLoopError(create.locationDummyNode(line, column))
  }
}

export function forceIt(val: any): any {
  if (val !== undefined && val !== null && val.isThunk === true) {
    if (val.isMemoized) {
      return val.memoizedValue
    }

    const evaluatedValue = forceIt(val.expr())

    val.isMemoized = true
    val.memoizedValue = evaluatedValue

    return evaluatedValue
  } else {
    return val
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

  candidate = forceIt(candidate)

  if (typeof candidate === 'function') {
    if (candidate.transformedFunction === undefined) {
      try {
        const forcedArgs = args.map(forceIt)
        return candidate(...forcedArgs)
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
  } else if (candidate instanceof LazyBuiltIn) {
    try {
      if (candidate.evaluateArgs) {
        args = args.map(forceIt)
      }
      return candidate.func(...args)
    } catch (error) {
      // if we already handled the error, simply pass it on
      if (!(error instanceof RuntimeSourceError || error instanceof ExceptionError)) {
        throw new ExceptionError(error, dummy.loc!)
      } else {
        throw error
      }
    }
  } else {
    throw new CallingNonFunctionValue(candidate, dummy)
  }
}

export function boolOrErr(candidate: any, line: number, column: number) {
  candidate = forceIt(candidate)
  const error = rttc.checkIfStatement(create.locationDummyNode(line, column), candidate)
  if (error === undefined) {
    return candidate
  } else {
    throw error
  }
}

export function unaryOp(operator: UnaryOperator, argument: any, line: number, column: number) {
  argument = forceIt(argument)
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
  left = forceIt(left)
  right = forceIt(right)
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
export const callIteratively = (f: any, maxExecTime: number, ...args: any[]) => {
  let line = -1
  let column = -1
  const startTime = Date.now()
  const pastCalls: [string, any[]][] = []
  while (true) {
    const dummy = locationDummyNode(line, column)
    f = forceIt(f)
    if (typeof f === 'function') {
      if (f.transformedFunction !== undefined) {
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
    } else if (f instanceof LazyBuiltIn) {
      if (f.evaluateArgs) {
        args = args.map(forceIt)
      }
      f = f.func
    } else {
      throw new CallingNonFunctionValue(f, dummy)
    }
    let res
    try {
      res = f(...args)
      if (Date.now() - startTime > maxExecTime) {
        throw new PotentialInfiniteRecursionError(dummy, pastCalls)
      }
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

export const wrap = (f: (...args: any[]) => any, stringified: string, maxExecTime: number) => {
  const wrapped = (...args: any[]) => callIteratively(f, maxExecTime, ...args)
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
