import { stringify } from '../utils/lazy-stringify'
import Thunk from '../interpreter/thunk'

/**
 * A function that displays to console.log by default (for a REPL).
 *
 * @param value the value to be represented and displayed.
 * @param externalContext a property of Context that can hold
 *   any information required for external use (optional).
 */
// export function* rawDisplay(t: Thunk, str: string, externalContext: any) {
//   const v = yield* t.evaluate()
//   // tslint:disable-next-line:no-console
//   console.log((str === undefined ? '' : str + ' ') + v.toString())
//   return v
// }

export function* error_message(t: Thunk, str?: string) {
  const v = yield* t.evaluate()
  const output = (str === undefined ? '' : str + ' ') + stringify(v)
  throw new Error(output)
}

export function* is_number(t: Thunk) {
  const v = yield* t.evaluate()
  return typeof v === 'number'
}

export function* is_undefined(t: Thunk) {
  const v = yield* t.evaluate()
  return typeof v === 'undefined'
}

export function* is_string(t: Thunk) {
  const v = yield* t.evaluate()
  return typeof v === 'string'
}

export function* is_boolean(t: Thunk) {
  const v = yield* t.evaluate()
  return typeof v === 'boolean'
}

export function* is_object(t: Thunk) {
  const v = yield* t.evaluate()
  return typeof v === 'object' || is_function(t)
}

export function* is_function(t: Thunk) {
  const v = yield* t.evaluate()
  return typeof v === 'function'
}

export function* is_NaN(t: Thunk) {
  return (yield* is_number(t)) && isNaN(yield* t.evaluate())
}

export function* has_own_property(obj: Thunk, p: Thunk) {
  return obj.value.hasOwnProperty(p.value)
}

export function* is_array(t: Thunk) {
  const v = yield* t.evaluate()
  return v instanceof Array
}

export function* array_length(t: Thunk) {
  const v = yield* t.evaluate()
  return v.length
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
export function* parse_int(ts: Thunk, tr: Thunk) {
  const str = yield* ts.evaluate()
  const radix = yield* tr.evaluate()
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

export function* runtime() {
  return new Date().getTime()
}
