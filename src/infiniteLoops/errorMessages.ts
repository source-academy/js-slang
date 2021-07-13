import { ExceptionError } from '../errors/errors'
import { TimeoutError } from '../errors/timeoutErrors'

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
