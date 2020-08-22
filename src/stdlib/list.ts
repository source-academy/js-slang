import { stringify, ArrayLike } from '../utils/stringify'
import { Value } from '../types'

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
  if (Array.isArray === undefined) {
    return x instanceof Array
  } else {
    return Array.isArray(x)
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
  return array_test(x) && x.length === 2
}

// head returns the first component of the given pair,
// throws an exception if the argument is not a pair
// LOW-LEVEL FUNCTION, NOT SOURCE
export function head(xs: any) {
  if (is_pair(xs)) {
    return xs[0]
  } else {
    throw new Error('head(xs) expects a pair as argument xs, but encountered ' + stringify(xs))
  }
}

// tail returns the second component of the given pair
// throws an exception if the argument is not a pair
// LOW-LEVEL FUNCTION, NOT SOURCE
export function tail(xs: any) {
  if (is_pair(xs)) {
    return xs[1]
  } else {
    throw new Error('tail(xs) expects a pair as argument xs, but encountered ' + stringify(xs))
  }
}

// is_null returns true if arg is exactly null
// LOW-LEVEL FUNCTION, NOT SOURCE
export function is_null(xs: List) {
  return xs === null
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

export function rawDisplayList(display: any, xs: Value, prepend: string) {
  const visited: Set<Value> = new Set() // Everything is put into this set, values, arrays, and even objects if they exist
  const asListObjects: Map<NonEmptyList, NonEmptyList | ListObject> = new Map() // maps original list nodes to new list nodes

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
    listNode: List

    constructor(listNode: List) {
      this.listNode = listNode
    }
  }
  function visit(curXs: Value): Value {
    if (visited.has(curXs)) {
      // `visit` doubles as an wrapper to access the new nodes/old nodes if they don't exist
      return asListObjects.get(curXs) || curXs
    }
    visited.add(curXs)
    if (!is_pair(curXs)) {
      return curXs
    }
    const h = head(curXs)
    const t = tail(curXs)
    visit(h)
    const newTail = visit(t)
    const newXs = is_null(newTail)
      ? new ListObject(pair(h, t))
      : newTail instanceof ListObject
      ? new ListObject(pair(h, t))
      : pair(h, t)
    asListObjects.set(curXs, newXs)
    return newXs
  }
  visit(xs)
  for (const curXs of asListObjects.values()) {
    if (is_pair(curXs)) {
      set_head(curXs, visit(head(curXs)))
      set_tail(curXs, visit(tail(curXs)))
    } else if (curXs instanceof ListObject) {
      set_head(curXs.listNode, visit(head(curXs.listNode)))
      let newTail = visit(tail(curXs.listNode))
      if (newTail instanceof ListObject) {
        newTail = newTail.listNode
      }
      set_tail(curXs.listNode, newTail)
    }
  }
  display(visit(xs), prepend)
  return xs
}
