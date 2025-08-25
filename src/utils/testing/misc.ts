import { expect, test, type TestContext as VitestTestContext } from 'vitest'
import type { Result } from '../..'
import { Finished, Value, Node, NodeTypeToNode } from '../../types'
import { Chapter } from '../../langs'
import { getChapterName } from '../misc'
import type { TestBuiltins, TestOptions } from './types'

/**
 * Convert the options provided by the user for each test into the full options
 * used by the testing system
 */
export function processTestOptions(rawOptions: TestOptions): Exclude<TestOptions, Chapter> {
  return typeof rawOptions === 'number'
    ? {
        chapter: rawOptions
      }
    : rawOptions
}

/**
 * Asserts that the given value is true
 */
export function assertTruthy(cond: boolean): asserts cond {
  expect(cond).toBeTruthy()
}

/**
 * Convenience wrapper for testing multiple cases with the same
 * test function
 */
export function testMultipleCases<T extends Array<any>>(
  cases: [string, ...T][],
  tester: (args: T, i: number) => void | Promise<void>,
  includeIndex?: boolean,
  timeout?: number
) {
  const withIndex = cases.map(([desc, ...c], i) => {
    const newDesc = includeIndex ? `${i + 1}. ${desc}` : desc
    return [newDesc, i, ...c] as [string, number, ...T]
  })
  test.each(withIndex)('%s', (_, i, ...args) => tester(args, i), timeout)
}

type TestingFunction<T extends Promise<void> | void> = (
  chapter: Chapter,
  context: VitestTestContext
) => T

/**
 * Convenience wrapper for testing a case with multiple chapters. Tests with source chapters 1-4 and the library parser
 */
export function testWithChapters<T extends Promise<void> | void>(
  this: void | undefined | boolean,
  func: TestingFunction<T>
): T

/**
 * Convenience wrapper for testing a case with multiple chapters. Tests with the given chapters. Returns a function
 * that should be called in the same way `test.each` is
 */
export function testWithChapters<T extends Promise<void> | void>(
  this: void | undefined | boolean,
  ...chapters: Chapter[]
): (f: TestingFunction<T>) => T
export function testWithChapters<T extends Promise<void> | void>(
  this: void | undefined | boolean,
  arg0: TestingFunction<T> | Chapter,
  ...chapters: Chapter[]
) {
  const testFunc = this ? test.skip : test

  function tester(chapters: Chapter[], func: TestingFunction<T>) {
    testFunc.for(chapters.map(chapter => [getChapterName(chapter), chapter] as [string, Chapter]))(
      'Testing %s',
      ([, chapter], context) => func(chapter, context)
    )
  }

  if (typeof arg0 === 'function') {
    return tester([Chapter.SOURCE_1, Chapter.SOURCE_2, Chapter.SOURCE_3, Chapter.SOURCE_4], arg0)
  }

  return (func: TestingFunction<T>) => tester([arg0, ...chapters], func)
}

testWithChapters.skip = function (...args: Parameters<typeof testWithChapters>) {
  return this.call(true, ...args)
}

/**
 * Asserts that the provided result is a `Finished`
 */
export function assertIsFinished(result: Result): asserts result is Finished {
  expect(result.status).toEqual('finished')
}

/**
 * Asserts that the provided result is both `Finished` and is equal to the given value
 */
export function assertFinishedResultValue(result: Result, value: Value) {
  assertIsFinished(result)
  expect(result.value).toEqual(value)
}

/**
 * Type safe assertion. Expects the given Node to have the provided type
 */
export function assertNodeType<T extends Node['type']>(
  typeStr: T,
  node: Node
): asserts node is NodeTypeToNode<T> {
  expect(node.type).toEqual(typeStr)
}

/**
 * Calls `eval` on the provided code with the provided builtins
 */
export function evalWithBuiltins(code: string, testBuiltins: TestBuiltins = {}) {
  // Ugly, but if you know how to `eval` code with some builtins attached, please change this.
  const builtins = Object.keys(testBuiltins).map(key => `const ${key} = testBuiltins.${key};`)
  const evalstring = builtins.join('\n') + code

  // tslint:disable-next-line:no-eval
  return eval(evalstring + code)
}
