import { TranspilerThunk } from './lazy'
import { Value } from '../types'
import { force, isTranspilerThunk } from './lazy'

export function is_number(v: TranspilerThunk<Value>) {
  return isType(v, 'number')
}

export function is_undefined(xs: TranspilerThunk<Value>) {
  return isType(xs, 'undefined')
}

export function is_string(xs: TranspilerThunk<Value>) {
  return isType(xs, 'string')
}

export function is_boolean(xs: TranspilerThunk<Value>) {
  return isType(xs, 'boolean')
}

export function is_function(xs: TranspilerThunk<Value>) {
  return isType(xs, 'function')
}

export function is_null(xs: TranspilerThunk<Value>) {
  return isTranspilerThunk(xs) ? xs.type === 'null' || force(xs) === null : xs === null
}

/**
 * Checks whether the value is a given type as a
 * string, or is a thunk that evaluates to that type.
 * @param value The value or lazy expression.
 * @param str String representing type.
 */
function isType(value: TranspilerThunk<Value>, str: string) {
  return isTranspilerThunk(value) ? value.type === str : typeof force(value) === str
}
