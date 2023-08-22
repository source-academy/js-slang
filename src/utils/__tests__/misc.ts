import { PromiseTimeoutError, timeoutPromise } from '../misc'

describe('test timeoutPromise', () => {
  const timedResolvedPromise = (duration: number) =>
    new Promise<void>(resolve => setTimeout(resolve, duration))
  const timedRejectedPromise = (duration: number) =>
    new Promise<void>((_, reject) => setTimeout(() => reject(-1), duration))

  test('Regular timeouts', async () => {
    const promise = timeoutPromise(timedResolvedPromise(100), 200)
    return expect(promise).resolves.toBeUndefined()
  })

  test('Rejected promise', () => {
    const promise = timeoutPromise(timedRejectedPromise(100), 200)
    return expect(promise).rejects.toEqual(-1)
  })

  test('Timeout on resolved promise', () => {
    const promise = timeoutPromise(timedResolvedPromise(200), 100)
    return expect(promise).rejects.toBeInstanceOf(PromiseTimeoutError)
  })

  test('Timeout on rejected promise', () => {
    const promise = timeoutPromise(timedRejectedPromise(200), 100)
    return expect(promise).rejects.toBeInstanceOf(PromiseTimeoutError)
  })
})
