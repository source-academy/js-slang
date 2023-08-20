import { RuntimeSourceError } from '../errors/runtimeSourceError'

export class TimeoutError extends RuntimeSourceError {}

export const timeoutPromise = <T>(promise: Promise<T>, timeout: number) =>
  new Promise<T>((resolve, reject) => {
    const timeoutid = setTimeout(() => reject(new TimeoutError()), timeout)

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
