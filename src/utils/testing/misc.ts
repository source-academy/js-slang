import type { MockedFunction } from 'jest-mock'
import type { Result } from '../..'
import type { Finished, Value, NodeTypeToNode, Chapter } from '../../types'
import type { Node } from '../ast/node'
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
 * Wrapper around the MockedFunction type to provide type checking
 * for mocked functions
 */
export function asMockedFunc<T extends (...args: any[]) => any>(func: T) {
  return func as MockedFunction<T>
}

/**
 * Asserts that the given value is true
 */
export function assertTrue(cond: boolean): asserts cond {
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

/**
 * Convenience wrapper for testing a case with multiple chapters
 */
export function testWithChapters(...chapters: Chapter[]) {
  return (func: (chapter: Chapter) => any) =>
    test.each(chapters.map(chapter => [getChapterName(chapter), chapter]))(
      'Testing %s',
      (_, chapter) => func(chapter)
    )
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
