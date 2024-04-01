import { RuntimeSourceError } from '../errors/runtimeSourceError'

export class PromiseTimeoutError extends RuntimeSourceError {}

export const timeoutPromise = <T>(promise: Promise<T>, timeout: number) =>
  new Promise<T>((resolve, reject) => {
    const timeoutid = setTimeout(() => reject(new PromiseTimeoutError()), timeout)

    promise
      .then(res => {
        clearTimeout(timeoutid)
        resolve(res)
      })
      .catch(e => {
        clearTimeout(timeoutid)
        reject(e)
      })
  })

/**
 * Run the mapping function over the items, filtering out any items that
 * that the mapping function returned `undefined` for
 */
export function mapAndFilter<T, U>(items: T[], mapper: (input: T) => U | undefined) {
  return items.reduce((res, item) => {
    const newItem = mapper(item)
    if (newItem !== undefined) return [...res, newItem]
    return res
  }, [] as U[])
}
