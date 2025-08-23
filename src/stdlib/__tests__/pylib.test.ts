import { test } from 'vitest'
import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { expectFinishedResult, expectParsedError } from '../../utils/testing'

test('adding two integers is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1 + 2
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(3n)
})

test('adding two floats is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1.0 + 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(3)
})

test('adding an integer and a float is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1.0 + 2
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(3)
})

test('adding a string and an integer is ok', () => {
  return expectFinishedResult(
    stripIndent`
    "a" + 1
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual('a1')
})

test('minusing two integers is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1 - 2
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(-1n)
})

test('minusing two floats is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1.0 - 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(-1)
})

test('minusing an integer from a float is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1.0 - 2
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(-1)
})

test('multiplying integer and float is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1.0 * 2
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(2)
})

test('multiplying integer and integer is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1 * 2
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(2n)
})

test('multiplying float and float is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1.0 * 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(2)
})

test('cannot multiply non-number values', () => {
  return expectParsedError(
    stripIndent`
    True * 2
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toMatchInlineSnapshot(`"Line 1: Error: Invalid types for multiply operation: boolean, bigint"`)
})

test('dividing integer and float is ok', () => {
  return expectFinishedResult(
    stripIndent`
    2 / 1.0
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(2)
})

test('dividing integer and integer is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1 / 2
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(0.5)
})

test('dividing float and float is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1.0 / 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(0.5)
})

test('cannot divide non-number values', () => {
  return expectParsedError(
    stripIndent`
    "a" / 2
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})

test('modding integer and float is ok', () => {
  return expectFinishedResult(
    stripIndent`
    2 % 1.0
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(0)
})

test('modding integer and integer is ok', () => {
  return expectFinishedResult(
    stripIndent`
    2 % 1
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(0n)
})

test('modding float and float is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1.0 % 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(1.0)
})

test('cannot mod non-number values', () => {
  return expectParsedError(
    stripIndent`
    "a" % 2
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})

test('powering integer and float is ok', () => {
  return expectFinishedResult(
    stripIndent`
    2 ** 1.0
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(2.0)
})

test('powering integer and integer is ok', () => {
  return expectFinishedResult(
    stripIndent`
    2 ** 1
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(2n)
})

test('powering float and float is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1.0 ** 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(1.0)
})

test('cannot power non-number values', () => {
  return expectParsedError(
    stripIndent`
    "a" ** 2
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})

test('flooring integer and float is ok', () => {
  return expectFinishedResult(
    stripIndent`
    2 // 1.0
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(2n)
})

test('flooring integer and integer is ok', () => {
  return expectFinishedResult(
    stripIndent`
    2 // 1
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(2n)
})

test('flooring float and float is ok', () => {
  return expectFinishedResult(
    stripIndent`
    1.0 // 2.0
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toEqual(0n)
})

test('cannot floor non-number values', () => {
  return expectParsedError(
    stripIndent`
    "a" // 2
  `,
    { chapter: Chapter.PYTHON_1 }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})
