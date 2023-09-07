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
