import { expect, test } from 'vitest'
import { _Symbol } from '../../alt-langs/scheme/scm-slang/src/stdlib/base'
import { match } from '../patterns'

function makeList(...args: any[]) {
  return args.reduceRight((acc, x) => {
    return [x, acc]
  }, null)
}

test('match works on exactly equal items', () => {
  const result = match(1, 1, [])
  expect(result).toEqual(true)
})

test('match works on exactly equal lists', () => {
  const result = match(makeList(1, 2, 3), makeList(1, 2, 3), [])
  expect(result).toEqual(true)
})

test('match works on exactly equal improper lists', () => {
  const result = match([1, 2], [1, 2], [])
  expect(result).toEqual(true)
})

test('match works on a symbol', () => {
  const result = match(makeList(1, 2, 3), makeList(1, new _Symbol('x'), 3), [])
  expect(result).toEqual(true)
})

test('match works on a symbol with anything', () => {
  const result = match(makeList(1, 2, 3), new _Symbol('x'), [])
  expect(result).toEqual(true)
})

test('match works on a pair (improper list)', () => {
  const result = match(makeList(1, 2, 3), [new _Symbol('head'), new _Symbol('tail')], [])
  expect(result).toEqual(true)
})

test('match fails when input does not match literal pattern', () => {
  const result = match(makeList(1, 2, 3), 4, [])
  expect(result).toEqual(false)
})

test('match fails when input does not match syntax literal', () => {
  const result = match(makeList(1, 2, 3), new _Symbol('x'), ['x'])
  expect(result).toEqual(false)
})

test('match fails when input does not match list', () => {
  const result = match(1, makeList(1, 2, 3), [])
  expect(result).toEqual(false)
})
