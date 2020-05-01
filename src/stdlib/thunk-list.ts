/**
 * Based on list.ts, implements lazy list with thunk.<br/>
 * No list_to_vector and vector_to_list function compared with list.ts,
 * since these two functions are not builtin functions for any chapter.<br/>
 * For internal use of these two functions, createContext.ts would call
 * them from list.ts.
 * @packageDocumentation
 */

import { stringify } from '../utils/stringify'
import { dethunk } from '../interpreter/thunk'

/**
 * Defines type `Pair` in the form of two-element JacaScript array.
 */
export type Pair<H, T> = [H, T]
/**
 * Defines type `List` to be `NonEmptyList` or `null`.
 */
export type List = null | NonEmptyList
interface NonEmptyList extends Pair<any, any> {}

/**
 * Checks if `x` is an array.<br/>
 * Works differently for Rhino and the Firefox environment (especially Web Console).<br/>
 * Not a butin function.
 * @param x Could be anything.
 * @returns Retuerns true if `x` is an array.
 */
function array_test(x: any) {
  if (Array.isArray === undefined) {
    return x instanceof Array
  } else {
    return Array.isArray(x)
  }
}

/**
 * Constructs a pair using a two-element array.<br/>
 * Is thunk-aware(`pair.isThunkAware === true`).
 * @param x First component of the pair.
 * @param xs Second component of the pair.
 * @returns Returns a pair (`[x, xs]`).
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* pair<H, T>(x: H, xs: T): Generator<Pair<H, T>> {
  return [x, xs]
}
Object.defineProperty(pair, 'isThunkAware', { value: true })

/**
 * checks if `x` is a pair.<br/>
 * Is thunk-aware(`is_pair.isThunkAware === true`).
 * @param x Could be anything.
 * @returns Returns true iff `x` is a two-element array.
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* is_pair(x: any) {
  x = yield* dethunk(x)
  return array_test(x) && x.length === 2
}
Object.defineProperty(is_pair, 'isThunkAware', { value: true })

/**
 * Returns the first component of the given pair.<br/>
 * Throws an exception if the argument is not a pair.<br/>
 * Is thunk-aware(`head.isThunkAware === true`).
 * @param xs Should be a pair.
 * @returns Returns head of `xs`
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* head(xs: any) {
  xs = yield* dethunk(xs)
  if (yield* is_pair(xs)) {
    return yield* dethunk(xs[0])
  } else {
    throw new Error('head(xs) expects a pair as argument xs, but encountered ' + stringify(xs))
  }
}
Object.defineProperty(head, 'isThunkAware', { value: true })

/**
 * Returns the second component of the given pair.<br/>
 * Throws an exception if the argument is not a pair.<br/>
 * Is thunk-aware(`tail.isThunkAware === true`).
 * @param xs Should be a pair.
 * @returns Returns tail of `xs`
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* tail(xs: any) {
  xs = yield* dethunk(xs)
  if (yield* is_pair(xs)) {
    return yield* dethunk(xs[1])
  } else {
    throw new Error('tail(xs) expects a pair as argument xs, but encountered ' + stringify(xs))
  }
}
Object.defineProperty(tail, 'isThunkAware', { value: true })

/**
 * Check if a list is null.<br/>
 * Is thunk-aware(`is_null.isThunkAware === true`).<br/>
 * @param xs Default to be a list.
 * @returns Returns true is `xs` is null.
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* is_null(xs: any) {
  xs = yield* dethunk(xs)
  return xs === null
}
Object.defineProperty(is_null, 'isThunkAware', { value: true })

/**
 * Make a list out of its arguments.<br/>
 * Is thunk-aware(`list.isThunkAware === true`).
 * @param elements Could be anything.
 * @returns Returns a list of elements in given order.
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* list(...elements: any[]): Generator<List> {
  let theList = null
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    theList = yield* pair(elements[i], theList)
  }
  return theList
}
Object.defineProperty(list, 'isThunkAware', { value: true })

/**
 * Change value of head of the given pair.<br/>
 * Throws an exception if `xs` is not a pair.<br/>
 * Is thunk-aware(`set_head.isThunkAware === true`).
 * @param xs Should be a pair.
 * @param x Could be any value to replace head of `xs`.
 * @returns Returns undefined.
 */
// LOW-LEVEL FUNCTION, NO SOURCE
export function* set_head(xs: any, x: any) {
  xs = yield* dethunk(xs)
  if (yield* is_pair(xs)) {
    xs[0] = x
    return undefined
  } else {
    throw new Error(
      'set_head(xs,x) expects a pair as argument xs, but encountered ' + stringify(xs)
    )
  }
}
Object.defineProperty(set_head, 'isThunkAware', { value: true })

/**
 * Change value of tail of the given pair.<br/>
 * Throws an exception if `xs` is not a pair.<br/>
 * Is thunk-aware(`set_tail.isThunkAware === true`).
 * @param xs Should be a pair.
 * @param x Could be any value to replace head of `xs`.
 * @returns Returns undefined.
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function* set_tail(xs: any, x: any) {
  xs = yield* dethunk(xs)
  if (yield* is_pair(xs)) {
    xs[1] = x
    return undefined
  } else {
    throw new Error(
      'set_tail(xs,x) expects a pair as argument xs, but encountered ' + stringify(xs)
    )
  }
}
Object.defineProperty(set_tail, 'isThunkAware', { value: true })
