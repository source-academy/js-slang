/**
 * Defines type `Stream`, and function `stream`, `list_to_stream`,
 * `stream_tail` for the use of stream, supporting thunk.<br/>
 * May not be very meaningful since in fact,<br/>
 * lazy-list is lazier than lazy-stream.
 * @packageDocumentation
 */

import { stringify } from '../utils/stringify'
import { head, is_null, is_pair, list, List, pair, Pair, tail } from './thunk-list'

/**
 * Defines type `Stream`.
 */
type Stream = Pair<any, () => any> | null

/**
 * Returns the second component of the given stream, for stream implemented with thunk.<br/>
 * Throws an exception if the argument is not a stream.<br/>
 * Is thunk-aware(`stream_tail.isThunkAware === true`).
 * @param xs Should be a stream.
 * @returns Tail of the given stream `xs`.
 */
export function* stream_tail(xs: any) {
  let theTail
  if (is_pair(xs)) {
    theTail = yield* tail(xs)
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
Object.defineProperty(stream_tail, 'isThunkAware', { value: true })

/**
 * Returns a stream from a sequence of elements.<br/>
 * Calls `list_to_stream` to build a stream.<br/>
 * Is thunk-aware(`stream.isThunkAware === true`).
 * @param elements Could be any possible arguments.
 * @returns A stream of arguments in given order.
 */
// LOW-LEVEL FUNCTION, NOT SOURCE
// Lazy? No: the tail of a stream is generated recursively.
export function* stream(...elements: any[]): Generator<Stream> {
  return yield* list_to_stream(yield* list(...elements))
}
Object.defineProperty(stream, 'isThunkAware', { value: true })

/**
 * Return a stream from a sequence of elements.<br/>
 * Throws an error if `xs` is not a list.<br/>
 * Not lazy since the tail of a stream is generated recursively.<br/>
 * Is thunk-aware(`list_to_stream.isThunkAware === true`).
 * @param xs Should be a list.
 * @returns A stream of all elements of `xs` in their order in `xs`.
 */
export function* list_to_stream(xs: List): Generator<Stream> {
  if (yield* is_null(xs)) {
    return null
  } else if (yield* is_pair(xs)) {
    const theTail = yield* list_to_stream(yield* tail(xs))
    return yield* pair(yield* head(xs), () => theTail)
  } else {
    throw new Error(
      'list_to_stream(xs) expects a list as argument xs, but encountered ' + stringify(xs)
    )
  }
}
Object.defineProperty(list_to_stream, 'isThunkAware', { value: true })
