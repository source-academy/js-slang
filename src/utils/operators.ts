import type { BinaryOperator, UnaryOperator } from 'estree'

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
import { Chapter, type NativeStorage } from '../types'
import { callExpression, locationDummyNode } from './ast/astCreator'
import * as create from './ast/astCreator'
import { makeWrapper } from './makeWrapper'
import * as rttc from './rttc'

export function throwIfTimeout(
  nativeStorage: NativeStorage,
  start: number,
  current: number,
  line: number,
  column: number,
  source: string | null
) {
  if (current - start > nativeStorage.maxExecTime) {
    throw new PotentialInfiniteLoopError(
      create.locationDummyNode(line, column, source),
      nativeStorage.maxExecTime
    )
  }
}

export function callIfFuncAndRightArgs(
  candidate: any,
  line: number,
  column: number,
  source: string | null,
  ...args: any[]
) {
  const dummy = create.callExpression(create.locationDummyNode(line, column, source), args, {
    start: { line, column },
    end: { line, column }
  })

  if (typeof candidate === 'function') {
    const originalCandidate = candidate
    if (candidate.transformedFunction !== undefined) {
      candidate = candidate.transformedFunction
    }
    const expectedLength = candidate.length
    const receivedLength = args.length
    const hasVarArgs = candidate.minArgsNeeded !== undefined
    if (hasVarArgs ? candidate.minArgsNeeded > receivedLength : expectedLength !== receivedLength) {
      throw new InvalidNumberOfArguments(
        dummy,
        hasVarArgs ? candidate.minArgsNeeded : expectedLength,
        receivedLength,
        hasVarArgs
      )
    }
    try {
      return originalCandidate(...args)
    } catch (error) {
      // if we already handled the error, simply pass it on
      if (!(error instanceof RuntimeSourceError || error instanceof ExceptionError)) {
        throw new ExceptionError(error, dummy.loc)
      } else {
        throw error
      }
    }
  } else {
    throw new CallingNonFunctionValue(candidate, dummy)
  }
}

export function boolOrErr(candidate: any, line: number, column: number, source: string | null) {
  const error = rttc.checkIfStatement(create.locationDummyNode(line, column, source), candidate)
  if (error === undefined) {
    return candidate
  } else {
    throw error
  }
}

export function unaryOp(
  operator: UnaryOperator,
  argument: any,
  line: number,
  column: number,
  source: string | null
) {
  const error = rttc.checkUnaryExpression(
    create.locationDummyNode(line, column, source),
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
  } else if (operator === 'typeof') {
    return typeof value
  } else {
    return +value
  }
}

export function binaryOp(
  operator: BinaryOperator,
  chapter: Chapter,
  left: any,
  right: any,
  line: number,
  column: number,
  source: string | null
) {
  const error = rttc.checkBinaryExpression(
    create.locationDummyNode(line, column, source),
    operator,
    chapter,
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
export const callIteratively = (f: any, nativeStorage: NativeStorage, ...args: any[]) => {
  let line = -1
  let column = -1
  let source: string | null = null
  const startTime = Date.now()
  const pastCalls: [string, any[]][] = []
  while (true) {
    const dummy = locationDummyNode(line, column, source)
    if (typeof f === 'function') {
      if (f.transformedFunction !== undefined) {
        f = f.transformedFunction
      }
      const expectedLength = f.length
      const receivedLength = args.length
      const hasVarArgs = f.minArgsNeeded !== undefined
      if (hasVarArgs ? f.minArgsNeeded > receivedLength : expectedLength !== receivedLength) {
        throw new InvalidNumberOfArguments(
          callExpression(dummy, args, {
            start: { line, column },
            end: { line, column },
            source
          }),
          hasVarArgs ? f.minArgsNeeded : expectedLength,
          receivedLength,
          hasVarArgs
        )
      }
    } else {
      throw new CallingNonFunctionValue(f, dummy)
    }
    let res
    try {
      res = f(...args)
      if (Date.now() - startTime > nativeStorage.maxExecTime) {
        throw new PotentialInfiniteRecursionError(dummy, pastCalls, nativeStorage.maxExecTime)
      }
    } catch (error) {
      // if we already handled the error, simply pass it on
      if (!(error instanceof RuntimeSourceError || error instanceof ExceptionError)) {
        throw new ExceptionError(error, dummy.loc)
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
      source = res.source
      pastCalls.push([res.functionName, args])
    } else if (res.isTail === false) {
      return res.value
    } else {
      return res
    }
  }
}

export const wrap = (
  f: (...args: any[]) => any,
  stringified: string,
  hasVarArgs: boolean,
  nativeStorage: NativeStorage
) => {
  if (hasVarArgs) {
    // @ts-ignore
    f.minArgsNeeded = f.length
  }
  const wrapped = (...args: any[]) => callIteratively(f, nativeStorage, ...args)
  makeWrapper(f, wrapped)
  wrapped.transformedFunction = f
  wrapped[Symbol.toStringTag] = () => stringified
  wrapped.toString = () => stringified
  return wrapped
}

export const setProp = (
  obj: any,
  prop: any,
  value: any,
  line: number,
  column: number,
  source: string | null
) => {
  const dummy = locationDummyNode(line, column, source)
  const error = rttc.checkMemberAccess(dummy, obj, prop)
  if (error === undefined) {
    return (obj[prop] = value)
  } else {
    throw error
  }
}

export const getProp = (
  obj: any,
  prop: any,
  line: number,
  column: number,
  source: string | null
) => {
  const dummy = locationDummyNode(line, column, source)
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
