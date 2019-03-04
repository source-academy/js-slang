import { InvalidNumberOfArguments } from '../interpreter-errors'
import * as create from './astCreator'

/**
 * Limitations:
 * Obviously, if objects ({}) are reintroduced,
 * we have to change this for a more stringent check,
 * as isTail and transformedFunctions are properties
 * and may be added by Source code.
 */
export const callIteratively = (f: any, ...args: any[]) => {
  // console.log('fcall');
  let line = -1
  let column = -1
  while (true) {
    if (typeof f !== 'function') {
      throw new TypeError('Calling non-function value ' + f)
    }
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
