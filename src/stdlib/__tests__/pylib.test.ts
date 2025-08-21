import { expect, test } from 'vitest'
import { Chapter } from '../../langs'
import { testFailure, testForValue } from '../../utils/testing'

type TestCase = [desc: string, code: string, expected: any]

test.each([
  ['adding two integers is ok', '1 + 2', 3n],
  ['adding two floats is ok', '1.0 + 2.0', 3],
  ['adding an integer and a float is ok', '1.0 + 2', 3],
  ['adding a string and an integer is ok', '"a" + 1', 'a1'],

  ['minusing two integers is ok', '1 - 2', -1n],
  ['minusing two floats is ok', '1.0 - 2.0', -1],
  ['minusing an integer from a float is ok', '1.0 - 2', -1],

  ['multiplying intger and integer is ok', '1 * 2', 2n],
  ['multiplying float and float is ok', '1.0 * 2.0', 2],
  ['multiplying integer and float is ok', '1.0 * 2', 2],

  ['dividing integer and integer is ok', '1 / 2', 0.5],
  ['dividing integer and float is ok', '2 / 1.0', 2],

  ['modding integer and integer is ok', '2 % 1', 0n],
  ['modding float and float is ok', '1.0 % 2.0', 1.0],
  ['modding integer and float is ok', '2 % 1.0', 0],

  ['powering two integers is ok', '2 ** 1', 2n],
  ['powering two floats is ok', '2.0 ** 1.0', 2.0],
  ['powering integer and float is ok', '2 ** 1.0', 2.0],

  ['floordiv two integers is ok', '2 // 1', 2n],
  ['floordiv two floats is ok', '2.0 // 1.0', 2n],
  ['floordiv integer and float is ok', '2 // 1.0', 2n]
] satisfies TestCase[])('%s', (_, code, expected) => {
  return expect(testForValue(code, Chapter.PYTHON_1)).resolves.toEqual(expected)
})

test('cannot multiply non-number values', () => {
  return expect(testFailure(`True * 2`, Chapter.PYTHON_1)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: Invalid types for multiply operation: boolean, bigint"`
  )
})

test('cannot divide non-number values', () => {
  return expect(testFailure(`"a" / 2`, Chapter.PYTHON_1)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})

test('cannot mod non-number values', () => {
  return expect(testFailure(`"a" % 2`, Chapter.PYTHON_1)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})

test('cannot power non-number values', () => {
  return expect(testFailure(`"a" ** 2`, Chapter.PYTHON_1)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})

test('cannot floor non-number values', () => {
  return expect(testFailure(`"a" // 2`, Chapter.PYTHON_1)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})
