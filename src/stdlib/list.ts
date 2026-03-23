/**
 * list.ts: Supporting lists in the Scheme style, using pairs made
 *          up of two-element JavaScript array (vector)
 * @author: Martin Henz
 * Translated to TypeScript by Evan Sebastian
 */

import { GeneralRuntimeError } from '../errors/base'
import type { Value } from '../types'
import { type ArrayLike, stringify } from '../utils/stringify'

export type Pair<H, T> = [H, T]
export type List<T = unknown> = null | NonEmptyList<T>
export type NonEmptyList<T> = Pair<T, any>

// array test works differently for Rhino and
// the Firefox environment (especially Web Console)
function array_test(x: unknown): x is unknown[] {
  if (Array.isArray === undefined) {
    return x instanceof Array
  } else {
    return Array.isArray(x)
  }
}

/**
 * constructs a pair using a two-element array\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 */
export function pair<H, T>(x: H, xs: T): Pair<H, T> {
  return [x, xs]
}

/**
 * returns true iff arg is a two-element array\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 */
export function is_pair(x: unknown): x is Pair<unknown, unknown> {
  return array_test(x) && x.length === 2
}

/**
 * returns the first component of the given pair\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 * @throws an exception if the argument is not a pair
 */
export function head<T>(xs: Pair<T, unknown> | NonEmptyList<T>): T
export function head(xs: unknown) {
  if (is_pair(xs)) {
    return xs[0]
  } else {
    throw new GeneralRuntimeError(
      `${head.name}(xs) expects a pair as argument xs, but encountered ${stringify(xs)}`
    )
  }
}

/**
 * returns the second component of the given pair\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 * @throws an exception if the argument is not a pair
 */
export function tail<T>(xs: Pair<unknown, T>): T
export function tail<T>(xs: NonEmptyList<T>): List<T>
export function tail(xs: unknown) {
  if (is_pair(xs)) {
    return xs[1]
  } else {
    throw new GeneralRuntimeError(
      `${tail.name}(xs) expects a pair as argument xs, but encountered ${stringify(xs)}`
    )
  }
}

/**
 * changes the head of given pair xs to be x\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 * @throws an exception if the argument is not a pair
 */
export function set_head(xs: Pair<any, any>, x: any): void {
  if (is_pair(xs)) {
    xs[0] = x
  } else {
    throw new GeneralRuntimeError(
      `${set_head.name}(xs,x) expects a pair as argument xs, but encountered ${stringify(xs)}`
    )
  }
}

/**
 * changes the tail of given pair xs to be x\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 * @throws an exception if the argument is not a pair
 */
export function set_tail(xs: Pair<any, any>, x: any): void {
  if (is_pair(xs)) {
    xs[1] = x
  } else {
    throw new GeneralRuntimeError(
      `${set_tail.name}(xs,x) expects a pair as argument xs, but encountered ${stringify(xs)}`
    )
  }
}

/**
 * returns true if arg is exactly null\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 */
export function is_null(xs: unknown): xs is null {
  return xs === null
}

/**
 * makes a list out of its arguments\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 */
export function list<T>(...elements: T[]): NonEmptyList<T>
export function list<T>(): List<T>
export function list<T>(...elements: T[]): List<T> {
  let theList = null
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    theList = pair(elements[i], theList)
  }
  return theList
}

/**
 * recurses down the list and checks that it ends with the empty list null\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 */
export function is_list(xs: unknown): xs is List<unknown> {
  while (is_pair(xs)) {
    xs = tail(xs)
  }
  return is_null(xs)
}

/**
 * returns vector that contains the elements of the argument list
 * in the given order.\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 * @throws an exception if the argument is not a list
 */
export function list_to_vector<T>(lst: List<T>): T[] {
  const vector = []
  while (!is_null(lst)) {
    vector.push(head(lst))
    lst = tail(lst)
  }
  return vector
}

/**
 * returns a list that contains the elements of the argument vector
 * in the given order\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 * @throws an exception if the argument is not a vector
 */
export function vector_to_list<T>(vector: T[]): List<T> {
  return list(...vector)
}

/**
 * build_list returns a list of n elements, that results from
 * applying the provided to the numbers from 0 to n-1.
 *
 * @param f Function to apply
 * @param n Number of elements
 */
export function build_list<T>(f: (n: number) => T, n: number): List<T> {
  function $build_list(i: number, already_built: List<T>): List<T> {
    return i < 0 ? already_built : $build_list(i - 1, pair(f(i), already_built))
  }

  return $build_list(n - 1, null)
}

/**
 * Accumulate applies given operation op to elements of a list
 * in a right-to-left order, first apply op to the last element
 * and an initial element, resulting in r1, then to the second-last
 * element and r1, resulting in r2, etc, and finally to the first element
 * and r_n-1, where n is the length of the list. `accumulate(op,zero,list(1,2,3))`
 * results in `op(1, op(2, op(3, zero)))`
 */
export function accumulate<T, U>(op: (each: T, result: U) => U, initial: U, sequence: List<T>): U {
  // Use CPS to prevent stack overflow
  function $accumulate(xs: typeof sequence, cont: (each: U) => U): U {
    return is_null(xs) ? cont(initial) : $accumulate(tail(xs), x => cont(op(head(xs), x)))
  }
  return $accumulate(sequence, x => x)
}

/**
 * Appends the list `ys` to the end of list `xs` and returns the
 * resulting list
 */
export function append<T>(xs: List<T>, ys: List<T>): List<T> {
  function $append(xs: List<T>, ys: List<T>, cont: (res: List<T>) => List<T>): List<T> {
    return is_null(xs) ? cont(ys) : $append(tail(xs), ys, zs => cont(pair(head(xs), zs)))
  }

  return $append(xs, ys, xs => xs)
}

/**
 * Calls the provided function on each element of the provides list, and returns
 * a new list containing the results
 */
export function map<T, U>(op: (each: T) => U, sequence: List<T>): List<U> {
  return accumulate((each, result) => pair(op(each), result), list(), sequence)
}

/**
 * Returns a new list that only contains elements that the predicate function returned `true`
 * for
 */
export function filter<T, U extends T>(pred: (arg: T) => arg is U, xs: List<T>): List<U>
export function filter<T>(pred: (arg: T) => boolean, xs: List<T>): List<T>
export function filter<T>(pred: (arg: T) => boolean, xs: List<T>): List<T> {
  return accumulate((each, result) => (pred(each) ? pair(each, result) : result), list(), xs)
}

/**
 * Applies the provided function to each element in the list. Returns `true`.
 */
export function for_each<T>(op: (arg: T) => void, xs: List<T>): true {
  if (is_null(xs)) return true
  op(head(xs))
  return for_each(op, tail(xs))
}

/**
 * Returns the element at the `n`th index in the provided list
 */
export function list_ref<T>(xs: List<T>, n: number): T {
  for (let i = 0; i < n && !is_null(xs); i++) {
    xs = tail(xs)
  }

  if (is_null(xs)) {
    throw new GeneralRuntimeError(`${list_ref.name}(xs, n): Index ${n} is out of bounds.`)
  }

  return head(xs)
}

/**
 * Returns the length of a List xs. Throws an exception if xs is not a List
 */
export function length(xs: List<any>): number {
  return accumulate((_, total) => total + 1, 0, xs)
}

export function rawDisplayList(display: any, xs: Value, prepend: string) {
  const visited: Set<Value> = new Set() // Everything is put into this set, values, arrays, and even objects if they exist
  const asListObjects: Map<NonEmptyList<unknown>, NonEmptyList<unknown> | ListObject> = new Map() // maps original list nodes to new list nodes

  // We will convert list-like structures in xs to ListObject.
  class ListObject implements ArrayLike {
    replPrefix = 'list('
    replSuffix = ')'
    replArrayContents(): Value[] {
      const result: Value[] = []
      let curXs = this.listNode
      while (curXs !== null) {
        result.push(head(curXs))
        curXs = tail(curXs)
      }
      return result
    }

    constructor(public listNode: NonEmptyList<any>) {}
  }
  function getListObject(curXs: Value): Value {
    return asListObjects.get(curXs) || curXs
  }

  const pairsToProcess: Value[] = []
  let i = 0
  pairsToProcess.push(xs)
  // we need the guarantee that if there are any proper lists,
  // then the nodes of the proper list appear as a subsequence of this array.
  // We ensure this by always adding the tail after the current node is processed.
  // This means that sometimes, we add the same pair more than once!
  // But because we only process each pair once due to the visited check,
  // and each pair can only contribute to at most 3 items in this array,
  // this array has O(n) elements.
  while (i < pairsToProcess.length) {
    const curXs = pairsToProcess[i]
    i++
    if (visited.has(curXs)) {
      continue
    }
    visited.add(curXs)
    if (!is_pair(curXs)) {
      continue
    }
    pairsToProcess.push(head(curXs), tail(curXs))
  }

  // go through pairs in reverse to ensure the dependencies are resolved first
  while (pairsToProcess.length > 0) {
    const curXs = pairsToProcess.pop()
    if (!is_pair(curXs)) {
      continue
    }
    const h = head(curXs)
    const t = tail(curXs)
    const newTail = getListObject(t) // the reason why we need the above guarantee
    const newXs =
      is_null(newTail) || newTail instanceof ListObject
        ? new ListObject(pair(h, t)) // tail is a proper list
        : pair(h, t) // it's not a proper list, make a copy of the pair so we can change references below
    asListObjects.set(curXs, newXs)
  }

  for (const curXs of asListObjects.values()) {
    if (is_pair(curXs)) {
      set_head(curXs, getListObject(head(curXs)))
      set_tail(curXs, getListObject(tail(curXs)))
    } else if (curXs instanceof ListObject) {
      set_head(curXs.listNode, getListObject(head(curXs.listNode)))
      let newTail = getListObject(tail(curXs.listNode))
      if (newTail instanceof ListObject) {
        newTail = newTail.listNode
      }
      set_tail(curXs.listNode, newTail)
    }
  }
  display(getListObject(xs), prepend)
  return xs
}
