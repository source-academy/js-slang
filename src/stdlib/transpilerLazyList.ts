import { stringify } from '../utils/stringify'
import { force_once, TranspilerThunk, force } from '../transpiler/lazyTranspiler'

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

export const pairType = 'pair'

// pair constructs a pair using a two-element array
// LOW-LEVEL FUNCTION, NOT SOURCE
export function pair<H, T>(x: H, xs: T): TranspilerThunk<Pair<H, T>> {
  const stringRep = '[' + stringify(x) + ', ' + stringify(xs) + ']'
  return {
    type: pairType,
    value: () => [x, xs],
    toString: () => stringRep,
    evaluated: true
  }
}

// is_pair returns true iff arg is a two-element array
// LOW-LEVEL FUNCTION, NOT SOURCE
export function is_pair(x: any) {
  const p: any = force(x)
  return array_test(p) && p.length === 2
}

// head returns the first component of the given pair,
// throws an exception if the argument is not a pair
// LOW-LEVEL FUNCTION, NOT SOURCE
// in head, the pair thunk needs to be evaluated
export function head(xs: any) {
  const p: any = force(xs)
  if (is_pair(p)) {
    return p[0]
  } else {
    throw new Error(
      'head(xs) expects a pair as argument xs, but encountered ' + stringify(force_once(xs))
    )
  }
}

// tail returns the second component of the given pair
// throws an exception if the argument is not a pair
// LOW-LEVEL FUNCTION, NOT SOURCE
// in tail, the pair thunk needs to be evaluated
export function tail(xs: any) {
  const p: any = force(xs)
  if (is_pair(p)) {
    return p[1]
  } else {
    throw new Error(
      'tail(xs) expects a pair as argument xs, but encountered ' + stringify(force_once(xs))
    )
  }
}

// list makes a list out of its arguments eagerly
// LOW-LEVEL FUNCTION, NOT SOURCE
export function list(...elements: any[]): TranspilerThunk<List> {
  let theList: List = null
  let stringRep = 'null'
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    theList = [elements[i], theList]
    stringRep = '[' + stringify(elements[i]) + ', ' + stringRep + ']'
  }
  return {
    type: 'pair',
    value: () => theList,
    toString: () => stringRep,
    evaluated: true
  }
}
