import { stringify } from '../utils/stringify'
import { isInterpreterThunk } from '../interpreter/lazyInterpreter'
import { force, force_once } from './interpreterLazyTypeCheck'

// list.ts: Supporting lists in the Scheme style, using pairs made
//          up of two-element JavaScript array (vector)
// Author: Martin Henz
// Translated to TypeScript by Evan Sebastian
export type Pair<H, T> = [H, T]
export type List = null | NonEmptyList
interface NonEmptyList extends Pair<any, any> {}

// array test works differently for Rhino and
// the Firefox environment (especially Web Console)
function array_test(x: any) {
  if (isInterpreterThunk(x)) {
    const result = force_once(x)
    if (Array.isArray === undefined) {
      return result instanceof Array
    } else {
      return Array.isArray(result)
    }
  } else {
    if (Array.isArray === undefined) {
      return x instanceof Array
    } else {
      return Array.isArray(x)
    }
  }
}

// pair constructs a pair using a two-element array
// LOW-LEVEL FUNCTION, NOT SOURCE
export function pair<H, T>(x: H, xs: T): Pair<H, T> {
  return [x, xs]
}

// is_pair returns true iff arg is a two-element array
// LOW-LEVEL FUNCTION, NOT SOURCE
export function is_pair(x: any) {
  if (isInterpreterThunk(x)) {
    const result = force_once(x)
    return array_test(result) && result.length === 2
  } else {
    return array_test(x) && x.length === 2
  }
}

// head returns the first component of the given pair,
// throws an exception if the argument is not a pair
// LOW-LEVEL FUNCTION, NOT SOURCE
export function head(xs: any) {
  if (isInterpreterThunk(xs)) {
    const result = force(xs)
    if (result !== null && is_pair(result)) {
      // If head is a thunk, force its value.
      if (result[0] !== null && isInterpreterThunk(result[0])) {
        return force(result[0])
      } else {
        return result[0]
      }
    } else {
      throw new Error(
        'head(xs) expects a pair as argument xs, but encountered ' + stringify(result)
      )
    }
  } else {
    if (is_pair(xs)) {
      return xs[0]
    } else {
      throw new Error('head(xs) expects a pair as argument xs, but encountered ' + stringify(xs))
    }
  }
}

// tail returns the second component of the given pair
// throws an exception if the argument is not a pair
// LOW-LEVEL FUNCTION, NOT SOURCE
export function tail(xs: any) {
  if (isInterpreterThunk(xs)) {
    const result = force(xs)
    if (result !== null && is_pair(result)) {
      // If tail is a thunk, force its value.
      if (result[1] !== null && isInterpreterThunk(result[1])) {
        return force(result[1])
      } else {
        return result[1]
      }
    } else {
      throw new Error(
        'tail(xs) expects a pair as argument xs, but encountered ' + stringify(result)
      )
    }
  } else {
    if (is_pair(xs)) {
      return xs[1]
    } else {
      throw new Error('tail(xs) expects a pair as argument xs, but encountered ' + stringify(xs))
    }
  }
}

// is_null returns true if arg is exactly null
// LOW-LEVEL FUNCTION, NOT SOURCE
export function is_null(xs: any) {
  if (isInterpreterThunk(xs)) {
    const result = force_once(xs)
    return result === null
  } else {
    return xs === null
  }
}

// list makes a list out of its arguments
// LOW-LEVEL FUNCTION, NOT SOURCE
export function list(...elements: any[]): List {
  let theList = null
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    theList = pair(elements[i], theList)
  }
  return theList
}

/* Not supported in Lazy Evaluation

// list_to_vector returns vector that contains the elements of the argument list
// in the given order.
// list_to_vector throws an exception if the argument is not a list
// LOW-LEVEL FUNCTION, NOT SOURCE
export function list_to_vector(lst: List) {
  const vector = []
  while (!is_null(lst)) {
    vector.push(head(lst))
    lst = tail(lst)
  }
  return vector
}

// vector_to_list returns a list that contains the elements of the argument vector
// in the given order.
// vector_to_list throws an exception if the argument is not a vector
// LOW-LEVEL FUNCTION, NOT SOURCE
export function vector_to_list(vector: any[]): List {
  return list(...vector)
}

// set_head(xs,x) changes the head of given pair xs to be x,
// throws an exception if the argument is not a pair
// LOW-LEVEL FUNCTION, NOT SOURCE

export function set_head(xs: any, x: any) {
  if (is_pair(xs)) {
    xs[0] = x
    return undefined
  } else {
    throw new Error(
      'set_head(xs,x) expects a pair as argument xs, but encountered ' + stringify(xs)
    )
  }
}

// set_tail(xs,x) changes the tail of given pair xs to be x,
// throws an exception if the argument is not a pair
// LOW-LEVEL FUNCTION, NOT SOURCE

export function set_tail(xs: any, x: any) {
  if (is_pair(xs)) {
    xs[1] = x
    return undefined
  } else {
    throw new Error(
      'set_tail(xs,x) expects a pair as argument xs, but encountered ' + stringify(xs)
    )
  }
}

*/
