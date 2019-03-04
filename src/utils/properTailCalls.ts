import { JSSLANG_PROPERTIES } from '../constants'
import { InvalidNumberOfArguments } from '../interpreter-errors'
import { PotentialInfiniteRecursionError } from '../native-errors'
import { locationDummyNode } from './astCreator'

/**
 * Limitations:
 * Obviously, if objects ({}) are reintroduced,
 * we have to change this for a more stringent check,
 * as isTail and transformedFunctions are properties
 * and may be added by Source code.
 */
export const callIteratively = (f: any, ...args: any[]) => {
  let line = -1
  let column = -1
  const ITERATIONS_BEFORE_TIME_CHECK = 1000
  const MAX_TIME = JSSLANG_PROPERTIES.maxExecTime
  let iterations = 0
  const startTime = Date.now()
  const pastCalls: Array<[string, any[]]> = []
  while (true) {
    if (iterations > ITERATIONS_BEFORE_TIME_CHECK) {
      if (Date.now() - startTime > MAX_TIME) {
        throw new PotentialInfiniteRecursionError(locationDummyNode(line, column), pastCalls)
      }
      iterations = 0
    } else if (typeof f !== 'function') {
      throw new TypeError('Calling non-function value ' + f)
    }
    iterations += 1
    if (f.transformedFunction! !== undefined) {
      f = f.transformedFunction
      const expectedLength = f.length
      const receivedLength = args.length
      if (expectedLength !== receivedLength) {
        throw new InvalidNumberOfArguments(
          create.callExpression(create.locationDummyNode(line, column), args, {
            start: { line, column },
            end: { line, column }
          }),
          expectedLength,
          receivedLength
        )
      }
    }
    const res = f(...args)
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
