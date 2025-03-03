import type { MockedFunction } from 'jest-mock'
import type { Result } from '../..'
import type { Finished, Value, Node, NodeTypeToNode, Chapter } from '../../types'
import type { TestBuiltins, TestOptions } from './types'

/**
 * Convert the options provided by the user for each test into the full options
 * used by the testing system
 */
export function processTestOptions(rawOptions: TestOptions = {}): Exclude<TestOptions, Chapter> {
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

export function expectTrue(cond: boolean): asserts cond {
  expect(cond).toEqual(true)
}

/**
 * Asserts that the provided result is a `Finished`
 */
export function expectFinishedResult(result: Result): asserts result is Finished {
  expect(result.status).toEqual('finished')
}

/**
 * Assers that the provided result is both `Finished` and is equal to the given value
 */
export function expectFinishedResultValue(result: Result, value: Value) {
  expectFinishedResult(result)
  expect(result.value).toEqual(value)
}

/**
 * Type safe assertion. Expects the given Node to have the provided type
 */
export function expectNodeType<T extends Node['type']>(
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
