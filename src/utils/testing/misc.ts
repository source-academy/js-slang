import type { MockedFunction } from 'jest-mock'
import type { Result } from '../..'
import type { Finished, Value, Node, NodeTypeToNode, Chapter } from '../../types'
import type { TestBuiltins, TestOptions } from './types'

export function processTestOptions(rawOptions: TestOptions = {}): Exclude<TestOptions, Chapter> {
  return typeof rawOptions === 'number'
    ? {
        chapter: rawOptions
      }
    : rawOptions
}

export function asMockedFunc<T extends (...args: any[]) => any>(func: T) {
  return func as MockedFunction<T>
}

export function expectTrue(cond: boolean): asserts cond {
  expect(cond).toEqual(true)
}

export function expectFinishedResult(result: Result): asserts result is Finished {
  expect(result.status).toEqual('finished')
}

export function expectFinishedResultValue(result: Result, value: Value) {
  expectFinishedResult(result)
  expect(result.value).toEqual(value)
}

export function expectNodeType<T extends Node['type']>(
  typeStr: T,
  node: Node
): asserts node is NodeTypeToNode<T> {
  expect(node.type).toEqual(typeStr)
}

export function evalWithBuiltins(code: string, testBuiltins: TestBuiltins = {}) {
  // Ugly, but if you know how to `eval` code with some builtins attached, please change this.
  const builtins = Object.keys(testBuiltins).map(key => `const ${key} = testBuiltins.${key};`)
  const evalstring = builtins.join('\n') + code

  // tslint:disable-next-line:no-eval
  return eval(evalstring + code)
}
