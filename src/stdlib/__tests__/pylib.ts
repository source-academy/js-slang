import { expect, test } from 'vitest'
import { Chapter } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { testFailure, testSuccess, } from '../../utils/testing'

test('adding two integers is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1 + 2
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(3n)
})

test('adding two floats is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1.0 + 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(3)
})

test('adding an integer and a float is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1.0 + 2
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(3)
})

test('adding a string and an integer is ok', () => {
  return expect(testSuccess(
    stripIndent`
    "a" + 1
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual('a1')
})

test('minusing two integers is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1 - 2
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(-1n)
})

test('minusing two floats is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1.0 - 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(-1)
})

test('minusing an integer from a float is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1.0 - 2
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(-1)
})

test('multiplying integer and float is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1.0 * 2
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(2)
})

test('multiplying integer and integer is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1 * 2
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(2n)
})

test('multiplying float and float is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1.0 * 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(2)
})

test('cannot multiply non-number values', () => {
  return expect(testFailure(
    stripIndent`
    True * 2
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toMatchInlineSnapshot(`"Line 1: Error: Invalid types for multiply operation: boolean, bigint"`)
})

test('dividing integer and float is ok', () => {
  return expect(testSuccess(
    stripIndent`
    2 / 1.0
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(2)
})

test('dividing integer and integer is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1 / 2
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(0.5)
})

test('dividing float and float is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1.0 / 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(0.5)
})

test('cannot divide non-number values', () => {
  return expect(testFailure(
    stripIndent`
    "a" / 2
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})

test('modding integer and float is ok', () => {
  return expect(testSuccess(
    stripIndent`
    2 % 1.0
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(0)
})

test('modding integer and integer is ok', () => {
  return expect(testSuccess(
    stripIndent`
    2 % 1
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(0n)
})

test('modding float and float is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1.0 % 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(1.0)
})

test('cannot mod non-number values', () => {
  return expect(testFailure(
    stripIndent`
    "a" % 2
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})

test('powering integer and float is ok', () => {
  return expect(testSuccess(
    stripIndent`
    2 ** 1.0
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(2.0)
})

test('powering integer and integer is ok', () => {
  return expect(testSuccess(
    stripIndent`
    2 ** 1
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(2n)
})

test('powering float and float is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1.0 ** 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(1.0)
})

test('cannot power non-number values', () => {
  return expect(testFailure(
    stripIndent`
    "a" ** 2
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})

test('flooring integer and float is ok', () => {
  return expect(testSuccess(
    stripIndent`
    2 // 1.0
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(2n)
})

test('flooring integer and integer is ok', () => {
  return expect(testSuccess(
    stripIndent`
    2 // 1
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(2n)
})

test('flooring float and float is ok', () => {
  return expect(testSuccess(
    stripIndent`
    1.0 // 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toEqual(0n)
})

test('cannot floor non-number values', () => {
  return expect(testFailure(
    stripIndent`
    "a" // 2
  `,
    { chapter: Chapter.PYTHON_1 }
  )).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})
