// we need this file for now, because the lazy variants
// of Source cannot handle ... yet

import { List, Pair, head, is_null, list, pair, tail } from './list'

type Stream = null | Pair<any, () => Stream>

// stream makes a stream out of its arguments
// LOW-LEVEL FUNCTION, NOT SOURCE
// Lazy? No: In this implementation, we generate first a
//           complete list, and then a stream using list_to_stream
export function stream(...elements: any[]): Stream {
  return list_to_stream(list(...elements))
}

// same as list_to_stream in stream.prelude.ts
function list_to_stream(xs: List): Stream {
  return is_null(xs) ? null : pair(head(xs), () => list_to_stream(tail(xs)))
}
