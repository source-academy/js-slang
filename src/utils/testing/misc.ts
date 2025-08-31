import { describe, expect, test, type TestContext as VitestTestContext } from 'vitest'
import type { Result } from '../..'
import type { Finished, Value, Node, NodeTypeToNode } from '../../types'
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
 * Utility type for removing the `this` parameter from a function's type
 */
type RemoveThis<T extends (this: any, ...args: any) => any> = T extends (
  this: any,
  ...args: infer U
) => any
  ? U
  : Parameters<T>

interface FuncWithSkipAndOnly<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T>
  skip: (...args: RemoveThis<T>) => ReturnType<T>
  only: (...args: RemoveThis<T>) => ReturnType<T>
}

/**
 * Refers to the three `describe` operations
 */
export type DescribeFunctions =
  | typeof describe
  | (typeof describe)['only']
  | (typeof describe)['skip']

/**
 * Refers to the three `test` operations
 */
export type TestFunctions = typeof test | (typeof test)['only'] | (typeof test)['skip']

/**
 * For functions that are designed to wrap around a `describe` or `test` block. Adds the `.only` and `.skip`
 * properties to them. The wrapped functions should use the `this` object to access the `test` or `describe` function
 * they are supposed to call.
 */
export function wrapWithSkipAndOnly<T extends (this: DescribeFunctions, ...args: any[]) => any>(
  type: 'describe',
  f: T
): FuncWithSkipAndOnly<T>
export function wrapWithSkipAndOnly<T extends (this: TestFunctions, ...args: any[]) => any>(
  type: 'test',
  f: T
): FuncWithSkipAndOnly<T>
export function wrapWithSkipAndOnly<
  T extends (this: TestFunctions | DescribeFunctions, ...args: any[]) => any
>(type: 'test' | 'describe', f: T) {
  function func(...args: Parameters<T>): ReturnType<T> {
    return f.call(type === 'test' ? test : describe, ...args)
  }

  func.skip = (...args: Parameters<T>) => {
    return f.call((type === 'test' ? test : describe).skip, ...args)
  }

  func.only = (...args: Parameters<T>) => {
    return f.call((type === 'test' ? test : describe).only, ...args)
  }

  return func as FuncWithSkipAndOnly<T>
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
export const testMultipleCases = wrapWithSkipAndOnly('test', function <
  T extends Array<any>
>(this: TestFunctions, cases: [string, ...T][], tester: (args: T, i: number) => void | Promise<void>, includeIndex?: boolean, timeout?: number) {
  const withIndex = cases.map(([desc, ...c], i) => {
    const newDesc = includeIndex ? `${i + 1}. ${desc}` : desc
    return [newDesc, i, ...c] as [string, number, ...T]
  })
  this.each(withIndex)('%s', (_, i, ...args) => tester(args, i), timeout)
})

type ChapterTestingFunction<T extends Promise<void> | void> = (
  chapter: Chapter,
  context: VitestTestContext
) => T

/**
 * Convenience wrapper for testing a case with multiple chapters. Tests with source chapters 1-4 and the library parser
 */
function testWithChaptersInternal<T extends Promise<void> | void>(
  this: TestFunctions,
  func: ChapterTestingFunction<T>
): T

/**
 * Convenience wrapper for testing a case with multiple chapters. Tests with the given chapters. Returns a function
 * that should be called in the same way `test.each` is
 */
function testWithChaptersInternal<T extends Promise<void> | void>(
  this: TestFunctions,
  ...chapters: Chapter[]
): (f: ChapterTestingFunction<T>) => T
function testWithChaptersInternal<T extends Promise<void> | void>(
  this: TestFunctions,
  arg0: ChapterTestingFunction<T> | Chapter,
  ...chapters: Chapter[]
) {
  const tester = (chapters: Chapter[], func: ChapterTestingFunction<T>) => {
    this.for(chapters.map(chapter => [getChapterName(chapter), chapter] as [string, Chapter]))(
      'Testing %s',
      ([, chapter], context) => func(chapter, context)
    )
  }

  if (typeof arg0 === 'function') {
    return tester([Chapter.SOURCE_1, Chapter.SOURCE_2, Chapter.SOURCE_3, Chapter.SOURCE_4], arg0)
  }

  return (func: ChapterTestingFunction<T>) => tester([arg0, ...chapters], func)
}

/**
 * @inheritDoc testWithChaptersInternal
 */
export const testWithChapters = wrapWithSkipAndOnly('test', testWithChaptersInternal)

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
