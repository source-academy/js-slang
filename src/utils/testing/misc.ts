import type { MockedFunction } from 'jest-mock'
import type { Result } from '../..'
import type { Finished } from '../../types'

export function asMockedFunc<T extends (...args: any[]) => any>(func: T) {
  return func as MockedFunction<T>
}

export function expectTrue(cond: boolean): asserts cond {
  expect(cond).toEqual(true)
}

export function expectFinishedResult(result: Result): asserts result is Finished {
  expect(result.status).toEqual('finished')
}
