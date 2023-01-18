import Closure from '../interpreter/closure'
import { Context, Value } from '../types'
import { stringify } from '../utils/stringify'

/**
 * A function that displays to console.log by default (for a REPL).
 *
 * @param value the value to be represented and displayed.
 * @param externalContext a property of Context that can hold
 *   any information required for external use (optional).
 */
export function rawDisplay(value: Value, str: string, _externalContext: any) {
  // tslint:disable-next-line:no-console
  console.log((str === undefined ? '' : str + ' ') + value.toString())
  return value
}

export function error_message(value: Value, ...strs: string[]) {
  const output = (strs[0] === undefined ? '' : strs[0] + ' ') + stringify(value)
  throw new Error(output)
}

export function timed(
  context: Context,
  // tslint:disable-next-line:ban-types
  f: Function,
  externalContext: any,
  displayBuiltin: (value: Value, str: string, externalContext: any) => Value
) {
  return (...args: any[]) => {
    const start = get_time()
    const result = f(...args)
    const diff = get_time() - start
    displayBuiltin('Duration: ' + Math.round(diff) + 'ms', '', externalContext)
    return result
  }
}

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

export function char_at(str: string, index: number) {
  if (typeof str !== 'string') {
    throw new Error('char_at expects the first argument to be a string.')
  } else if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
    throw new Error('char_at expects the second argument to be a nonnegative integer.')
  }
  return str[index]
}

/**
 * arity returns the number of parameters a given function `f` expects.
 *
 * @param f Function whose arity is to be found. Required.
 *
 * An error is thrown if `f` is not a function.
 */
export function arity(f: Function) {
  if (f instanceof Closure) {
    const params = f.node.params
    const hasVarArgs = params[params.length - 1]?.type === 'RestElement'
    return hasVarArgs ? params.length - 1 : params.length
  } else if (typeof f === 'function') {
    return f.length
  } else {
    throw new Error('arity expects a function as argument')
  }
}

export function get_time() {
  return new Date().getTime()
}
