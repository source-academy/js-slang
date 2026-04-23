import { GeneralRuntimeError } from '../errors/base';
import { InvalidParameterTypeError } from '../errors/rttcErrors';
import { wrap } from '../utils/operators';
import { head, is_null, is_pair, type List, type Pair, pair, tail } from './list';
import { arity } from './misc';

type NonEmptyStream<T = unknown> = Pair<T, () => Stream<T>>;
export type Stream<T = unknown> = null | NonEmptyStream<T>;

function createStreamPair<T>(item: T, next: () => Stream<T>): NonEmptyStream<T> {
  const streamTail = wrap(next, false, '() => ...');
  return pair(item, streamTail);
}

/**
 * Makes a Stream out of its arguments\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 */
export function stream(): null;
export function stream<T>(...elements: T[]): NonEmptyStream<T>;
export function stream<T>(...elements: T[]): Stream<T> {
  if (elements.length === 0) return null;

  const [item, ...rest] = elements;
  return createStreamPair(item, () => stream(...rest));
}

// same as list_to_stream in stream.prelude.ts
export function list_to_stream<T>(xs: List<T>): Stream<T> {
  return is_null(xs) ? null : createStreamPair(head(xs), () => list_to_stream(tail(xs)));
}

export function stream_tail<T>(stream: NonEmptyStream<T>): Stream<T>;
export function stream_tail(stream: unknown): Stream<unknown> {
  if (!is_pair(stream)) {
    throw new InvalidParameterTypeError('non-empty stream', stream, stream_tail.name);
  }

  const next = tail(stream);
  if (typeof next !== 'function' || arity(next) !== 0) {
    throw new InvalidParameterTypeError('stream', stream, stream_tail.name);
  }

  return next();
}

/**
 * Returns `true` is the given object is a stream.
 *
 * NOT Lazy: The function must evaluate all the elements of the stream
 */
export function is_stream(obj: unknown): obj is Stream<unknown> {
  if (is_null(obj)) return true;

  if (!is_pair(obj)) return false;
  const next = tail(obj);

  if (typeof next !== 'function') return false;
  if (arity(next) !== 0) return false;

  return is_stream(next());
}

/**
 * Constructs an infinite stream of integers, beginning with n, incrementing 1 at
 * a time.
 *
 * Lazy.
 */
export function integers_from(n: number): Stream<number> {
  return pair(n, () => integers_from(n + 1));
}

/**
 * Builds a stream of n elements by applying the provided function to the
 * numbers [0, n-1].
 *
 * Lazy: f is only called when the resulting stream is forced.
 */
export function build_stream<T>(f: (n: number) => T, n: number): Stream<T> {
  function build(i: number): Stream<T> {
    return i >= n ? null : pair(f(i), () => build(i + 1));
  }

  return build(0);
}

/**
 * Applies the provided function to elements of the given stream.
 *
 * Lazy: the provided function does not execute until the
 * forced by the resulting stream.
 */
export function stream_map<T, U>(f: (arg: T) => U, s: Stream<T>): Stream<U> {
  return is_null(s) ? null : pair(f(head(s)), () => stream_map(f, stream_tail(s)));
}

/**
 * Returns a substream containing the elements that the provided predicate returned `true` for.
 *
 * Partially Lazy: Both the predicate and stream are evaluated as necessary
 */
export function stream_filter<T, U extends T>(f: (arg: T) => arg is U, s: Stream<T>): Stream<U>;
export function stream_filter<T>(f: (arg: T) => boolean, s: Stream<T>): Stream<T>;
export function stream_filter<T>(f: (arg: T) => boolean, s: Stream<T>): Stream<T> {
  if (is_null(s)) return null;

  const should = f(head(s));

  return should
    ? pair(head(s), () => stream_filter(f, stream_tail(s)))
    : stream_filter(f, stream_tail(s));
}

/**
 * Applies the given function to every single element of the stream.
 *
 * NOT lazy: This function evaluates the entire stream.
 */
export function stream_for_each<T>(f: (arg: T) => void, s: Stream<T>) {
  if (is_null(s)) {
    return true;
  } else {
    f(head(s));
    return stream_for_each(f, stream_tail(s));
  }
}

/**
 * Accumulate applies given operation op to elements of a stream
 * in a right-to-left order, first apply op to the last element
 * and an initial element, resulting in r1, then to the second-last
 * element and r1, resulting in r2, etc, and finally to the first element
 * and r_n-1, where n is the length of the list. `accumulate(op,zero,list(1,2,3))`
 * results in `op(1, op(2, op(3, zero)))`.
 *
 * NOT lazy: This function evaluates the entire stream when called
 */
export function stream_accumulate<T, U>(
  f: (each: T, result: U) => U,
  initial: U,
  stream: Stream<T>,
): U {
  let res = initial;
  let entry = stream;

  while (!is_null(entry)) {
    const element = head(entry);
    res = f(element, res);
    entry = stream_tail(entry);
  }

  return res;
}

/**
 * Returns the length of the stream.
 *
 * NOT lazy: The function must evaluate the entire stream
 */
export function stream_length(s: Stream<unknown>): number {
  return stream_accumulate((_, res) => res + 1, 0, s);
}

/**
 * Returns the nth element of the stream.
 *
 * NOT lazy: The stream must be evaluated up to the nth element.
 */
export function stream_ref<T>(s: Stream<T>, n: number): T {
  for (let i = 0; i < n && !is_null(s); i++) {
    s = stream_tail(s);
  }

  if (is_null(s)) {
    throw new GeneralRuntimeError(`${stream_ref.name}: Index ${n} out of bounds!`);
  }

  return head(s);
}

/**
 * Appends a stream to the end of another stream.
 *
 * @param lhs Stream to append to
 * @param rhs Stream to be appending
 *
 * Lazy: `rhs` is only evaluated after `lhs` is fully evaluated. This
 * does mean that if `lhs` is infinite elements from `rhs` will never be evaluated.
 */
export function stream_append<T>(lhs: Stream<T>, rhs: Stream<T>): Stream<T> {
  return is_null(lhs) ? rhs : pair(head(lhs), () => stream_append(stream_tail(lhs), rhs));
}

/**
 * Converts the given stream to a {@link List|list}.
 *
 * NOT Lazy: Function has to evaluate every element of the stream
 * to populate the resulting list
 */
export function stream_to_list<T>(stream: Stream<T>): List<T> {
  return is_null(stream) ? null : pair(head(stream), stream_to_list(stream_tail(stream)));
}
