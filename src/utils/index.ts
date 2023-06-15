/**
 * A form of Array.reduce, but using an async reducer
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

export async function mapObjectAsync<
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

export const timeoutPromise = <T>(promise: Promise<T>, duration: number) => new Promise<T>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Timeout!')), duration)
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