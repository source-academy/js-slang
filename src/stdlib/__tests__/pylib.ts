import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { expectResult, expectParsedError } from '../../utils/testing'

test('adding two integers is ok', () => {
  return expectResult(
    stripIndent`
    __py_adder(BigInt(1), BigInt(2))
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(3n)
})

test('adding two floats is ok', () => {
  return expectResult(
    stripIndent`
    __py_adder(1.0, 2.0)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(3)
})

test('adding an integer and a float is ok', () => {
  return expectResult(
    stripIndent`
    __py_adder(1.0, BigInt(2))
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(3)
})
/* TODO: re-enable this test once py-slang submodule is updated
test('adding a string and an integer is ok', () => {
  return expectResult(
    stripIndent`
    __py_adder("a", BigInt(1))
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual('a1')
})
*/
test('minusing two integers is ok', () => {
  return expectResult(
    stripIndent`
    __py_minuser(BigInt(1), BigInt(2))
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(-1n)
})

test('minusing two floats is ok', () => {
  return expectResult(
    stripIndent`
    __py_minuser(1.0, 2.0)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(-1)
})

test('minusing an integer from a float is ok', () => {
  return expectResult(
    stripIndent`
    __py_minuser(1.0, BigInt(2))
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(-1)
})

test('multiplying integer and float is ok', () => {
  return expectResult(
    stripIndent`
    __py_multiplier(1.0, BigInt(2))
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(2)
})

test('multiplying integer and integer is ok', () => {
  return expectResult(
    stripIndent`
    __py_multiplier(BigInt(1), BigInt(2))
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(2n)
})

test('multiplying float and float is ok', () => {
  return expectResult(
    stripIndent`
    __py_multiplier(1.0, 2.0)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(2)
})

test('cannot multiply non-number values', () => {
  return expectParsedError(
    stripIndent`
    __py_multiplier("a", 2)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})

test('dividing integer and float is ok', () => {
  return expectResult(
    stripIndent`
    __py_divider(BigInt(2), 1.0)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(2)
})

test('dividing integer and integer is ok', () => {
  return expectResult(
    stripIndent`
    __py_divider(BigInt(1), BigInt(2))
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(0.5)
})

test('dividing float and float is ok', () => {
  return expectResult(
    stripIndent`
    __py_divider(1.0, 2.0)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(0.5)
})

test('cannot divide non-number values', () => {
  return expectParsedError(
    stripIndent`
    __py_divider("a", 2)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})

test('modding integer and float is ok', () => {
  return expectResult(
    stripIndent`
    __py_modder(BigInt(2), 1.0)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(0)
})

test('modding integer and integer is ok', () => {
  return expectResult(
    stripIndent`
    __py_modder(BigInt(2), BigInt(1))
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(0n)
})

test('modding float and float is ok', () => {
  return expectResult(
    stripIndent`
    __py_modder(1.0, 2.0)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(1.0)
})

test('cannot mod non-number values', () => {
  return expectParsedError(
    stripIndent`
    __py_modder("a", 2)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})

test('powering integer and float is ok', () => {
  return expectResult(
    stripIndent`
    __py_powerer(BigInt(2), 1.0)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(2.0)
})

test('powering integer and integer is ok', () => {
  return expectResult(
    stripIndent`
    __py_powerer(BigInt(2), BigInt(1))
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(2n)
})

test('powering float and float is ok', () => {
  return expectResult(
    stripIndent`
    __py_powerer(1.0, 2.0)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(1.0)
})

test('cannot power non-number values', () => {
  return expectParsedError(
    stripIndent`
    __py_powerer("a", 2)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})

test('flooring integer and float is ok', () => {
  return expectResult(
    stripIndent`
    __py_floorer(BigInt(2), 1.0)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(2n)
})

test('flooring integer and integer is ok', () => {
  return expectResult(
    stripIndent`
    __py_floorer(BigInt(2), BigInt(1))
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(2n)
})

test('flooring float and float is ok', () => {
  return expectResult(
    stripIndent`
    __py_floorer(1.0, 2.0)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toEqual(0n)
})

test('cannot floor non-number values', () => {
  return expectParsedError(
    stripIndent`
    __py_floorer("a", 2)
  `,
    { chapter: Chapter.PYTHON_1, native: true }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: Expected number on left hand side of operation, got string."`
  )
})
