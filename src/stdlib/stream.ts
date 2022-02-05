// stream_tail returns the second component of the given pair
// throws an exception if the argument is not a pair

import { head, is_null, is_pair, List, list, Pair, pair, tail } from './list'

type Stream = null | Pair<any, () => Stream>

export function stream_tail(xs: any) {
  let theTail
  if (is_pair(xs)) {
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
  return is_null(xs) ? null : pair(head(xs), () => list_to_stream(tail(xs)))
}
