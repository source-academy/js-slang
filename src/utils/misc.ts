import type { Node } from 'estree'

import { RuntimeSourceError } from '../errors/runtimeSourceError'

/**
 * A form of Array.reduce, but using an async reducer
 * It doesn't reduce everything asynchronously, but rather waits
 * for each call to the reducer to resolve sequentially
 */
export async function reduceAsync<T, U, Reducer extends (result: U, each: T) => Promise<U>>(
  arr: Iterable<T>,
  reducer: Reducer,
  init: U
) {
  let result: U = init
  for (const each of arr) {
    result = await reducer(result, each)
  }
  return result
}

/**
 * Calls the mapping function on the object to obtain an array of key value pairs,
 * then waits for all promises to resolve asynchronously using `Promise.all` before
 * returning the key value pairs as an object.
 */
export async function transformObjectAsync<
  T extends Record<any, any>,
  Mapper extends (key: keyof T, value: T[keyof T]) => Promise<any>
>(obj: T, mapper: Mapper) {
  const promises = Object.entries(obj).map(async ([key, value]) => [key, await mapper(key, value)])
  const results = await Promise.all(promises)

  return results.reduce(
    (res, [k, v]) => ({
      ...res,
      [k]: v
    }),
    {} as Record<keyof T, Awaited<ReturnType<Mapper>>>
  )
}

export class TimeoutError extends RuntimeSourceError {
  constructor(node?: Node) {
    super(node)
  }
}

/**
 * Wrap an existing promise that will throw an error after the given timeout
 * duration
 */
export const timeoutPromise = <T>(promise: Promise<T>, duration: number) =>
  new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new TimeoutError()), duration)
    promise
      .then(result => {
        clearTimeout(timeout)
        resolve(result)
      })
      .catch(err => {
        clearTimeout(timeout)
        reject(err)
      })
  })
