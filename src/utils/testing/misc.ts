import type { MockedFunction } from 'jest-mock';


export function asMockedFunc<T extends (...args: any[]) => any>(func: T) {
  return func as MockedFunction<T>;
}export function expectTrue(cond: boolean): asserts cond {
  expect(cond).toEqual(true)
}

