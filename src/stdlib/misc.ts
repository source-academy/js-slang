/* tslint:disable: ban-types*/
import { toString } from '../interop'
import { Context, Value } from '../types'

/**
 * A function that displays to console.log by default (for a REPL).
 *
 * @param value the value to be represented and displayed.
 * @param externalContext a property of Context that can hold
 *   any information required for external use (optional).
 */
export function display(value: Value, externalContext: any) {
  const output = toString(value)
  console.log(output)
}
display.__SOURCE__ = 'display(a)'

export function error_message(value: Value) {
  const output = toString(value)
  throw new Error(output)
}
error_message.__SOURCE__ = 'error(a)'

// tslint:disable-next-line:no-any
export function timed(context: Context, f: Function, externalContext: any, display: (value: Value, externalContext: any) => void) {
  return (...args: any[]) => {
    const start = runtime()
    const result = f(...args)
    const diff = runtime() - start
    display('Duration: ' + Math.round(diff) + 'ms', externalContext)
    return result
  }
}
timed.__SOURCE__ = 'timed(f)'

export function is_number(v: Value) {
  return typeof v === 'number'
}
is_number.__SOURCE__ = 'is_number(v)'

export function is_undefined(xs) {
  return typeof xs === 'undefined'
}
is_undefined.__SOURCE__ = 'is_undefined(xs)'

export function is_string(xs) {
  return typeof xs === 'string'
}
is_string.__SOURCE__ = 'is_string(xs)'

export function is_boolean(xs) {
  return typeof xs === 'boolean'
}
is_boolean.__SOURCE__ = 'is_boolean(xs)'

export function is_object(xs) {
  return typeof xs === 'object' || is_function(xs)
}
is_object.__SOURCE__ = 'is_object(xs)'

export function is_function(xs: Value) {
  return typeof xs === 'function'
}
is_function.__SOURCE__ = 'is_function(xs)'

export function is_NaN(x: Value) {
  return is_number(x) && isNaN(x)
}
is_NaN.__SOURCE__ = 'is_NaN(x)'

export function has_own_property(obj: Value, p: Value) {
  return obj.hasOwnProperty(p)
}
has_own_property.__SOURCE__ = 'has_own_property(obj, p)'

export function is_array(a: Value) {
  return a instanceof Array
}
is_array.__SOURCE__ = 'is_array(a)'

export function array_length(xs: Value[]) {
  return xs.length
}
array_length.__SOURCE__ = 'array_length(xs)'

export function parse_int(inputString: string, radix: number) {
  const parsed = parseInt(inputString, radix)
  if (inputString && radix && parsed) {
    // the two arguments are provided, and parsed is not NaN
    return parsed
  } else {
    throw new Error('parseInt expects two arguments a string s, and a positive integer i')
  }
}
parse_int.__SOURCE__ = 'parse_int(s, i)'

export function runtime() {
  return new Date().getTime()
}
runtime.__SOURCE__ = 'runtime()'
