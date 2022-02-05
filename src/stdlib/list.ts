import { Value } from '../types'
import { ArrayLike, stringify } from '../utils/stringify'

// list.ts: Supporting lists in the Scheme style, using pairs made
//          up of two-element JavaScript array (vector)
// Author: Martin Henz
// Translated to TypeScript by Evan Sebastian
export type Pair<H, T> = [H, T]
export type List = null | NonEmptyList
type NonEmptyList = Pair<any, any>

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

// recurses down the list and checks that it ends with the empty list null
// LOW-LEVEL FUNCTION, NOT SOURCE
export function is_list(xs: List) {
  while (is_pair(xs)) {
    xs = tail(xs)
  }
  return is_null(xs)
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
