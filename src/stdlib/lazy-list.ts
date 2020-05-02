import { stringify } from '../utils/eager-stringify'
import Thunk from '../interpreter/thunk'
import { Value } from '../types'

// array test works differently for Rhino and
// the Firefox environment (especially Web Console)
function array_test(x: any) {
  if (Array.isArray === undefined) {
    return x instanceof Array
  } else {
    return Array.isArray(x)
  }
}

// pair constructs a pair using a two-element array
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* pair(x: Thunk, xs: Thunk) {
  return [x, xs]
}

// is_pair returns true iff arg is a two-element array
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* is_pair(x: Thunk) {
  const value = yield* x.evaluate()
  return array_test(value) && value.length === 2
}

// head returns the first component of the given pair,
// throws an exception if the argument is not a pair
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* head(xs: Thunk) {
  if (yield* is_pair(xs)) {
    const [h] = yield* xs.evaluate()
    return yield* h.evaluate()
  } else {
    throw new Error('head(xs) expects a pair as argument xs, but encountered ' + stringify(xs))
  }
}

// tail returns the second component of the given pair
// throws an exception if the argument is not a pair
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* tail(xs: Thunk) {
  if (yield* is_pair(xs)) {
    const [, t] = yield* xs.evaluate()
    return yield* t.evaluate()
  } else {
    throw new Error('tail(xs) expects a pair as argument xs, but encountered ' + stringify(xs))
  }
}

// is_null returns true if arg is exactly null
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* is_null(xs: Thunk) {
  const value = yield* xs.evaluate()
  return value === null
}

// list makes a list out of its arguments
// LOW-LEVEL FUNCTION, NOT SOURCE
// TODO[@plty]: make this represents computation more.
export function* list(...elements: Thunk[]): IterableIterator<Value> {
  if (elements.length === 0) return null
  const [h, ...t] = elements
  return yield* pair(h, Thunk.from(yield* list(...t)))
}

// list_to_vector returns vector that contains the elements of the argument list
// in the given order.
// list_to_vector throws an exception if the argument is not a list
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* list_to_vector(lst: Thunk): IterableIterator<Value> {
  if (yield* is_null(lst)) return []
  const [h, t] = yield* lst.evaluate()
  return [h, ...(yield* list_to_vector(t))]
}

// vector_to_list returns a list that contains the elements of the argument vector
// in the given order.
// vector_to_list throws an exception if the argument is not a vector
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* vector_to_list(vector: any[]): IterableIterator<Value> {
  return yield* list(...vector)
}
