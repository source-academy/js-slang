import { head, is_null, type List, type Pair, pair, tail } from './list'

export type Stream<T = unknown> = null | Pair<T, () => Stream<T>>

/** 
 * Makes a Stream out of its arguments\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 */          
export function stream<T>(...elements: T[]): Stream<T> {
  if (elements.length === 0) return null

  const [item, ...rest] = elements
  return pair(item, () => stream(...rest))
}

// same as list_to_stream in stream.prelude.ts
export function list_to_stream<T>(xs: List<T>): Stream<T> {
  return is_null(xs) ? null : pair(head(xs), () => list_to_stream(tail(xs)))
}
