import * as list from '../stdlib/list'
import { List } from '../stdlib/list'
import { Value } from '../types'

// stream.ts: Supporting streams in the Scheme style, following
// "stream discipline"
// Author: Martin Henz

export type Stream = Value[]

// stream_tail returns the second component of the given pair
// throws an exception if the argument is not a pair
export function stream_tail(xs: Stream) {
  let tail
  if (list.is_pair(xs)) {
    tail = xs[1]
  } else {
    throw new Error('stream_tail(xs) expects a pair as ' + 'argument xs, but encountered ' + xs)
  }

  if (typeof tail === 'function') {
    return tail()
  } else {
    throw new Error(
      'stream_tail(xs) expects a function as ' +
        'the tail of the argument pair xs, ' +
        'but encountered ' +
        tail
    )
  }
}

// is_stream recurses down the stream and checks that it ends with the
// empty list null

export function is_stream(xs: Stream): boolean {
  return list.is_null(xs) || (list.is_pair(xs) && is_stream(stream_tail(xs)))
}

// A stream is either null or a pair whose tail is
// a nullary function that returns a stream.

export function list_to_stream(xs: List): Stream | null {
  return list.is_null(xs) ? null : list.pair(list.head(xs), () => list_to_stream(list.tail(xs)))
}

// stream_to_list transforms a given stream to a list
// Lazy? No: stream_to_list needs to force the whole stream
export function stream_to_list(xs: Stream): List | null {
  return list.is_null(xs) ? null : list.pair(list.head(xs), stream_to_list(stream_tail(xs)))
}

// stream makes a stream out of its arguments
// Lazy? No: In this implementation, we generate first a
//           complete list, and then a stream using list_to_stream
export function stream(): Stream | null {
  let the_list = null
  for (let i = arguments.length - 1; i >= 0; i--) {
    the_list = list.pair(arguments[i], the_list)
  }
  return list_to_stream(the_list as List)
}

// stream_length returns the length of a given argument stream
// throws an exception if the argument is not a stream
// Lazy? No: The function needs to explore the whole stream
export function stream_length(xs: Stream): number {
  return list.is_null(xs) ? 0 : 1 + stream_length(stream_tail(xs))
}

// stream_map applies first arg f to the elements of the second
// argument, assumed to be a stream.
// f is applied element-by-element:
// stream_map(f,list_to_stream(list(1,2)) results in
// the same as list_to_stream(list(f(1),f(2)))
// stream_map throws an exception if the second argument is not a
// stream, and if the second argument is a non-empty stream and the
// first argument is not a function.
// Lazy? Yes: The argument stream is only explored as forced by
//            the result stream.
// tslint:disable-next-line:ban-types
export function stream_map(f: Function, s: Stream): Stream | null {
  return list.is_null(s) ? null : list.pair(f(list.head(s)), () => stream_map(f, stream_tail(s)))
}

// build_stream takes a non-negative integer n as first argument,
// and a function fun as second argument.
// build_list returns a stream of n elements, that results from
// applying fun to the numbers from 0 to n-1.
// Lazy? Yes: The result stream forces the applications of fun
//            for the next element
// tslint:disable-next-line:ban-types
export function build_stream(n: number, fun: Function): Stream | null {
  if (typeof n !== 'number' || n < 0 || Math.floor(n) !== n) {
    throw new Error(
      'build_stream(n, fun) expects a positive integer as ' + 'argument n, but encountered ' + n
    )
  }
  function build(i: number) {
    return i >= n ? null : list.pair(fun(i), () => build(i + 1))
  }
  return build(0)
}

// stream_for_each applies first arg fun to the elements of the stream
// passed as second argument. fun is applied element-by-element:
// for_each(fun,list_to_stream(list(1, 2,null))) results in the calls fun(1)
// and fun(2).
// stream_for_each returns true.
// stream_for_each throws an exception if the second argument is not a
// stream, and if the second argument is a non-empty stream and the
// first argument is not a function.
// Lazy? No: stream_for_each forces the exploration of the entire stream
// tslint:disable-next-line:ban-types
export function stream_for_each(fun: Function, xs: Stream): boolean {
  if (!is_stream(xs)) {
    throw new Error('for_each expects a stream as argument xs, but encountered ' + xs)
  }
  if (list.is_null(xs)) {
    return true
  } else {
    fun(list.head(xs))
    return stream_for_each(fun, stream_tail(xs))
  }
}

// stream_reverse reverses the argument stream
// stream_reverse throws an exception if the argument is not a stream.
// Lazy? No: stream_reverse forces the exploration of the entire stream
export function stream_reverse(xs: Stream): Stream | null {
  function rev(original: Stream, reversed: Stream | null): Stream | null {
    return list.is_null(original)
      ? reversed
      : rev(stream_tail(original), list.pair(list.head(original), () => reversed))
  }
  return rev(xs, null)
}

// stream_append appends first argument stream and second argument stream.
// In the result, null at the end of the first argument stream
// is replaced by the second argument stream
// stream_append throws an exception if the first argument is not a
// stream.
// Lazy? Yes: the result stream forces the actual append operation
export function stream_append(xs: Stream, ys: Stream) {
  return list.is_null(xs) ? ys : list.pair(list.head(xs), () => stream_append(stream_tail(xs), ys))
}

// stream_member looks for a given first-argument element in a given
// second argument stream. It returns the first postfix substream
// that starts with the given element. It returns null if the
// element does not occur in the stream
// Lazy? Sort-of: stream_member forces the stream only until the element is found.
export function stream_member(x: Value, s: Stream): Stream | null {
  return list.is_null(s) ? null : list.head(s) === x ? s : stream_member(x, stream_tail(s))
}

// stream_remove removes the first occurrence of a given first-argument element
// in a given second-argument list. Returns the original list
// if there is no occurrence.
// Lazy? Yes: the result stream forces the construction of each next element
export function stream_remove(v: Value, xs: Stream): Stream | null {
  return list.is_null(xs)
    ? null
    : v === list.head(xs)
    ? stream_tail(xs)
    : list.pair(list.head(xs), () => stream_remove(v, stream_tail(xs)))
}

// stream_remove_all removes all instances of v instead of just the first.
// Lazy? Yes: the result stream forces the construction of each next element
export function stream_remove_all(v: Value, xs: Stream): Stream | null {
  return list.is_null(xs)
    ? null
    : v === list.head(xs)
    ? stream_remove_all(v, stream_tail(xs))
    : list.pair(list.head(xs), () => stream_remove_all(v, stream_tail(xs)))
}

// filter returns the substream of elements of given stream s
// for which the given predicate function p returns true.
// Lazy? Yes: The result stream forces the construction of
//            each next element. Of course, the construction
//            of the next element needs to go down the stream
//            until an element is found for which p holds.
// tslint:disable-next-line:ban-types
export function stream_filter(p: Function, s: Stream): Stream | null {
  return list.is_null(s)
    ? null
    : p(list.head(s))
    ? list.pair(list.head(s), () => stream_filter(p, stream_tail(s)))
    : stream_filter(p, stream_tail(s))
}

// enumerates numbers starting from start,
// using a step size of 1, until the number
// exceeds end.
// Lazy? Yes: The result stream forces the construction of
//            each next element
export function enum_stream(start: number, end: number): List | null {
  if (typeof start !== 'number') {
    throw new Error(
      'enum_list(start, end) expects a number as argument start, but encountered ' + start
    )
  }
  if (typeof end !== 'number') {
    throw new Error(
      'enum_list(start, end) expects a number as argument start, but encountered ' + end
    )
  }
  return start > end ? null : list.pair(start, () => enum_stream(start + 1, end))
}

// integers_from constructs an infinite stream of integers
// starting at a given number n
// Lazy? Yes: The result stream forces the construction of
//            each next element
export function integers_from(n: number): Stream {
  return list.pair(n, () => integers_from(n + 1))
}

// eval_stream constructs the list of the first n elements
// of a given stream s
// Lazy? Sort-of: eval_stream only forces the computation of
//                the first n elements, and leaves the rest of
//                the stream untouched.
export function eval_stream(s: Stream, n: number): List | null {
  return n === 0 ? null : list.pair(list.head(s), eval_stream(stream_tail(s), n - 1))
}

// Returns the item in stream s at index n (the first item is at position 0)
// Lazy? Sort-of: stream_ref only forces the computation of
//                the first n elements, and leaves the rest of
//                the stream untouched.
export function stream_ref(s: Stream, n: number): Value {
  if (typeof n !== 'number' || n < 0 || Math.floor(n) !== n) {
    throw new Error(
      'stream_ref(xs, n) expects a positive integer as argument n, but encountered ' + n
    )
  }
  return n === 0 ? list.head(s) : stream_ref(stream_tail(s), n - 1)
}
