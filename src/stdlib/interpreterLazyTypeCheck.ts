import { Value } from '../types'
import {
  isInterpreterThunk,
  evaluateThunkOnce,
  evaluateThunk
} from '../interpreter/lazyInterpreter'
import { is_pair, set_head, set_tail, head, tail } from './list'

export function is_thunk(v: Value) {
  if (isInterpreterThunk(v)) {
    // Unwrap once to expose the argument.
    const result = force_once(v)
    return result !== null ? isInterpreterThunk(result) : false
  } else {
    return false
  }
}

export function is_number(v: Value) {
  if (isInterpreterThunk(v)) {
    // Unwrap once to expose the argument.
    const result = force_once(v)
    return typeof result === 'number'
  } else {
    return typeof v === 'number'
  }
}

export function is_undefined(xs: Value) {
  if (isInterpreterThunk(xs)) {
    // Unwrap once to expose the argument.
    const result = force_once(xs)
    return typeof result === 'undefined'
  } else {
    return typeof xs === 'undefined'
  }
}

export function is_string(xs: Value) {
  if (isInterpreterThunk(xs)) {
    // Unwrap once to expose the argument.
    const result = force_once(xs)
    return typeof result === 'string'
  } else {
    return typeof xs === 'string'
  }
}

export function is_boolean(xs: Value) {
  if (isInterpreterThunk(xs)) {
    // Unwrap once to expose the argument.
    const result = force_once(xs)
    return typeof result === 'boolean'
  } else {
    return typeof xs === 'boolean'
  }
}

export function is_function(xs: Value) {
  if (isInterpreterThunk(xs)) {
    // Unwrap once to expose the argument.
    const result = force_once(xs)
    return typeof result === 'function'
  } else {
    return typeof xs === 'function'
  }
}

/**
 * Source (Lazy) version of parseInt. Both arguments are required.
 * The arguments for this function may or may not be Thunks.
 * `arg1` contains the actual value of the argument
 * `arg2` contains the actual value of the argument `radix`.
 *
 * @param str String representation of the integer to be parsed. Required.
 * @param radix Base to parse the given `str`. Required.
 *
 * An error is thrown if `arg1` is not of type string, or `arg2` is not an
 * integer within the range 2, 36 inclusive.
 */
export function parse_int(str: Value, radix: Value) {
  let arg1 = str
  let arg2 = radix
  arg1 = force_once(str) // will do nothing if arg is not a thunk
  arg2 = force_once(radix)
  if (
    typeof arg1 === 'string' &&
    typeof arg2 === 'number' &&
    Number.isInteger(arg2) &&
    2 <= arg2 &&
    arg2 <= 36
  ) {
    return parseInt(arg1, arg2)
  } else {
    throw new Error(
      'parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive.'
    )
  }
}

/**
 * Source built-in function.
 * Forces the value out from an expression.
 * @param v The input node/statement to be evaluated.
 * @returns The final value after evaluation.
 */
export function force(v: any) {
  if (isInterpreterThunk(v)) {
    // Evaluate to obtain the final value.
    const it = evaluateThunk(v, v.context)
    let result = it.next()
    while (!result.done) {
      result = it.next()
    }
    result = result.value
    return result
  } else {
    return v
  }
}

/**
 * Unwraps a Thunk to expose its underlying value.
 * May or may not return the final value.
 * @param v The input node/statement to be evaluated.
 * @returns The value extracted from the Thunk.
 */
export function force_once(v: any) {
  if (isInterpreterThunk(v)) {
    // Evaluate once.
    const it = evaluateThunkOnce(v, v.context)
    let result = it.next()
    while (!result.done) {
      result = it.next()
    }
    result = result.value
    return result
  } else {
    return v
  }
}

/**
 * Given a thunk that may possibly evaluate to a pair,
 * evaluate it and if it evaluates to a pair, forces
 * the evaluation of the head and tail as well.
 *
 * Note that force_pair performs deep evaluation on
 * the pair, so even if the head and tail of the pair
 * evaluates to another pair, that pair's head and
 * tail will be evaluated fully as well. This ensures
 * that force_pair will work for lists.
 *
 * @param v The input node/statement to be evaluated.
 * @returns The value extracted from the Thunk.
 */
export function force_pair(v: any) {
  const final = force(v)
  if (is_pair(final)) {
    set_head(final, force_pair(head(final)))
    set_tail(final, force_pair(tail(final)))
  }
  return final
}

/* Not supported in Lazy Evaluation

export function is_object(xs: Value) {
  return typeof xs === 'object' || is_function(xs)
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
