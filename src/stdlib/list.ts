/**
 * Supporting lists in the Scheme style, using pairs made up of two-element JavaScript array (vector).<br/>
 * Author: Martin Henz<br/>
 * Translated to TypeScript by Evan Sebastian
 * @packageDocumentation
 */

import { stringify } from '../utils/stringify'

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
 * Constructs a pair using a two-element array.
 * @param x First component of the pair.
 * @param xs Second component of the pair.
 * @returns Returns a pair (`[x, xs]`).
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function pair<H, T>(x: H, xs: T): Pair<H, T> {
  return [x, xs]
}

/**
 * checks if `x` is a pair.
 * @param x Could be anything.
 * @returns Returns true iff arg is a two-element array.
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function is_pair(x: any) {
  return array_test(x) && x.length === 2
}

/**
 * Returns the first component of the given pair.<br/>
 * Throws an exception if the argument is not a pair.
 * @param xs Should be a pair.
 * @returns Returns head of `xs`
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function head(xs: any) {
  if (is_pair(xs)) {
    return xs[0]
  } else {
    throw new Error('head(xs) expects a pair as argument xs, but encountered ' + stringify(xs))
  }
}

/**
 * Returns the second component of the given pair.<br/>
 * Throws an exception if the argument is not a pair.
 * @param xs Should be a pair.
 * @returns Returns tail of `xs`
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function tail(xs: any) {
  if (is_pair(xs)) {
    return xs[1]
  } else {
    throw new Error('tail(xs) expects a pair as argument xs, but encountered ' + stringify(xs))
  }
}

/**
 * Check if a list is null.
 * @param xs Default to be a list.
 * @returns Returns true is `xs` is null.
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function is_null(xs: List) {
  return xs === null
}

/**
 * Make a list out of its arguments.
 * @param elements Could be anything.
 * @returns Returns a list of elements in given order.
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function list(...elements: any[]): List {
  let theList = null
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    theList = pair(elements[i], theList)
  }
  return theList
}

/**
 * Convert a list into a vector.<br/>
 * Not a butin function.
 * @param lst Should be a list.
 * @returns Returns vector containing elements of `lst` in given order.
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function list_to_vector(lst: List) {
  const vector = []
  while (!is_null(lst)) {
    vector.push(head(lst))
    lst = tail(lst)
  }
  return vector
}

/**
 * Convert a vector into a list.<br/>
 * Not a butin function.
 * @param vector Should be a vector(JavaScript type array).
 * @returns Returns a list containing elements of input vector in given order.
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
export function vector_to_list(vector: any[]): List {
  return list(...vector)
}

/**
 * Change value of head of the given pair.<br/>
 * Throws an exception if `xs` is not a pair.
 * @param xs Should be a pair.
 * @param x Could be any value to replace head of `xs`.
 * @returns Returns undefined.
 */
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

/**
 * Change value of tail of the given pair.<br/>
 * Throws an exception if `xs` is not a pair.
 * @param xs Should be a pair.
 * @param x Could be any value to replace head of `xs`.
 * @returns Returns undefined.
 */
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
