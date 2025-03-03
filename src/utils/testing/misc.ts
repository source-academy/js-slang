import type { MockedFunction } from 'jest-mock'
import type { Result } from '../..'
import type { Finished, Value, Node, NodeTypeToNode } from '../../types'

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