import { stringify } from '../utils/stringify'
// stream_tail returns the second component of the given pair
// throws an exception if the argument is not a pair

import { head, is_null, is_pair, list, List, pair, Pair, tail } from './list' // delete List & Pair

type Stream = null | Pair<any, () => Stream>

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

// stream makes a stream out of its arguments
// LOW-LEVEL FUNCTION, NOT SOURCE
// Lazy? No: In this implementation, we generate first a
//           complete list, and then a stream using list_to_stream
export function stream(...elements: any[]): Stream {
  return list_to_stream(list(...elements))
}

export function list_to_stream(xs: List): Stream {
  if (is_null(xs) || is_pair(xs)) {
    return is_null(xs) ? null : pair(head(xs), () => list_to_stream(tail(xs)))
  } else {
    throw new Error(
      'list_to_stream(xs) expects a list as argument xs, but encountered ' + stringify(xs)
    )
  }
}
