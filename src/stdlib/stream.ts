/**
 * Defines type `Stream`, and function `stream`, `list_to_stream`, `stream_tail` for the use of stream.
 * @packageDocumentation
 */

import { stringify } from '../utils/stringify'
import { head, is_null, is_pair, list, List, pair, Pair, tail } from './list'

/**
 * Defines type `Stream = null | Pair<any, () => Stream>` recursively.
 */
type Stream = null | Pair<any, () => Stream>

/**
 * Returns the second component of the given stream.<br/>
 * Throws an error if the argument is not a stream.
 * @param xs Should be a stream.
 * @returns Tail of the given stream `xs`.
 */
export function stream_tail(xs: Stream) {
  let theTail
  if (xs === null) {
    return null
  } else if (is_pair(xs)) {
    theTail = xs[1]
  } else {
    throw new Error('stream_tail(xs) expects a pair as ' + 'argument xs, but encountered ' + xs)
  }

  if (typeof theTail === 'function') {
    return theTail()
  } else {
    throw new Error(
      'stream_tail(xs) expects a function as ' +
        'the tail of the argument pair xs, ' +
        'but encountered ' +
        theTail
    )
  }
}

/**
 * Returns a stream from arguments.<br/>
 * Calls `list_to_stream` to build a stream.
 * @param elements Could be any possible arguments.
 * @returns A stream of arguments in given order.
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
// Lazy? No: In this implementation, we generate first a
//           complete list, and then a stream using list_to_stream
export function stream(...elements: any[]): Stream {
  return list_to_stream(list(...elements))
}

/**
 * Returns a stream from a list.<br/>
 * Throws an error if `xs` is not a list.
 * @param xs Should be a list.
 * @returns A stream of all elements of `xs` in their order in `xs`.
 */
export function list_to_stream(xs: List): Stream {
  if (is_null(xs) || is_pair(xs)) {
    return is_null(xs) ? null : pair(head(xs), () => list_to_stream(tail(xs)))
  } else {
    throw new Error(
      'list_to_stream(xs) expects a list as argument xs, but encountered ' + stringify(xs)
    )
  }
}
