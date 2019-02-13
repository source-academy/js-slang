/**
 * Limitations:
 * Obviously, if objects ({}) are reintroduced,
 * we have to change this for a more stringent check,
 * as isTail and transformedFunctions are properties
 * and may be added by Source code.
 */
export const callIteratively = (f: any, ...args: any[]) => {
  try {
    // console.log('fcall');
    while (true) {
      if (typeof f !== 'function') {
        throw new TypeError('Calling non-function value ' + f)
      }
      if (f.transformedFunction! !== undefined) {
        f = f.transformedFunction
      }
      const res = f(...args)
      if (res && res.isTail) {
        f = res.function
        args = res.arguments
      } else if (res && res.value) {
        return res.value
      } else {
        return res
      }
    }
  } catch (e) {
    return e
  }
}

export const wrap = (f: (...args: any[]) => any) => {
  const wrapped = (...args: any[]) => callIteratively(f, ...args)
  wrapped.transformedFunction = f
  return wrapped
}
