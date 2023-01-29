import * as es from 'estree'

import { Context } from '..'
import { ExceptionError } from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { TimeoutError } from '../errors/timeoutErrors'
import { getOriginalName } from './instrument'

export enum StackOverflowMessages {
  firefox = 'InternalError: too much recursion',
  // webkit: chrome + safari. Also works for node
  webkit = 'RangeError: Maximum call stack size exceeded',
  edge = 'Error: Out of stack space'
}

/**
 * Checks if the error is a TimeoutError or Stack Overflow.
 *
 * @returns {true} if the error is a TimeoutError or Stack Overflow.
 * @returns {false} otherwise.
 */
export function isPotentialInfiniteLoop(error: any) {
  if (error instanceof TimeoutError) {
    return true
  } else if (error instanceof ExceptionError) {
    const message = error.explain()
    for (const toMatch of Object.values(StackOverflowMessages)) {
      if (message.includes(toMatch)) {
        return true
      }
    }
  }
  return false
}

export enum InfiniteLoopErrorType {
  NoBaseCase,
  Cycle,
  FromSmt
}

export class InfiniteLoopError extends RuntimeSourceError {
  public infiniteLoopType: InfiniteLoopErrorType
  public message: string
  public functionName: string | undefined
  public streamMode: boolean
  public codeStack: string[]
  constructor(
    functionName: string | undefined,
    streamMode: boolean,
    message: string,
    infiniteLoopType: InfiniteLoopErrorType
  ) {
    super()
    this.message = message
    this.infiniteLoopType = infiniteLoopType
    this.functionName = functionName
    this.streamMode = streamMode
  }
  public explain() {
    const entityName = this.functionName ? `function ${getOriginalName(this.functionName)}` : 'loop'
    return this.streamMode
      ? `The error may have arisen from forcing the infinite stream: ${entityName}.`
      : `The ${entityName} has encountered an infinite loop. ` + this.message
  }
}

/**
 * Determines whether the error is an infinite loop, and returns a tuple of
 * [error type, is stream, error message, previous code].
 *  *
 * @param {Context} - The context being used.
 *
 * @returns [error type, is stream, error message, previous programs] if the error was an infinite loop
 * @returns {undefined} otherwise
 */
export function getInfiniteLoopData(
  context: Context
): undefined | [InfiniteLoopErrorType, boolean, string, es.Program[]] {
  // return error type/string, prevCodeStack
  // cast as any to access infiniteLoopError property later
  const errors = context.errors
  let latestError: any = errors[errors.length - 1]
  if (latestError instanceof ExceptionError) {
    latestError = latestError.error
  }
  let infiniteLoopError
  if (latestError instanceof InfiniteLoopError) {
    infiniteLoopError = latestError
  } else if (latestError.hasOwnProperty('infiniteLoopError')) {
    infiniteLoopError = latestError.infiniteLoopError as InfiniteLoopError
  }
  if (infiniteLoopError) {
    return [
      infiniteLoopError.infiniteLoopType,
      infiniteLoopError.streamMode,
      infiniteLoopError.explain(),
      context.previousPrograms
    ]
  } else {
    return undefined
  }
}
