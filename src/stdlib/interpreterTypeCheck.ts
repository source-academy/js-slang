import { Context, Value } from '../types'
import { stringify } from '../utils/stringify'

export function is_number(v: Value) {
  return typeof v === 'number'
}

export function is_undefined(xs: Value) {
  return typeof xs === 'undefined'
}

export function is_string(xs: Value) {
  return typeof xs === 'string'
}

export function is_boolean(xs: Value) {
  return typeof xs === 'boolean'
}

/**
 * Source version of parseInt. Both arguments are required.
 *
 * @param str String representation of the integer to be parsed. Required.
 * @param radix Base to parse the given `str`. Required.
 *
 * An error is thrown if `str` is not of type string, or `radix` is not an
 * integer within the range 2, 36 inclusive.
 */
export function parse_int(str: string, radix: number) {
    if (
      typeof str === 'string' &&
      typeof radix === 'number' &&
      Number.isInteger(radix) &&
      2 <= radix &&
      radix <= 36
    ) {
      return parseInt(str, radix)
    } else {
      throw new Error(
        'parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive.'
      )
    }
  }

/* Not supported in Lazy Evaluation

export function is_object(xs: Value) {
  return typeof xs === 'object' || is_function(xs)
}

export function is_function(xs: Value) {
  return typeof xs === 'function'
}

export function is_NaN(x: Value) {
  return is_number(x) && isNaN(x)
}

export function has_own_property(obj: Value, p: Value) {
  return obj.hasOwnProperty(p)
}

export function is_array(a: Value) {
  return a instanceof Array
}

export function array_length(xs: Value[]) {
  return xs.length
}



export function runtime() {
  return new Date().getTime()
}

*/
