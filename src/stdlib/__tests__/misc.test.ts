import { expect, test } from 'vitest'
import { Chapter } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { testFailure, testForValue } from '../../utils/testing'

test('parse_int with valid args is ok, radix 2', () => {
  return expect(testForValue(`parse_int('1100101010101', 2);`)).resolves.toBe(
    parseInt('1100101010101', 2)
  )
})

test('parse_int with valid args is ok, radix 36', () => {
  return expect(testForValue(`parse_int('uu1', 36);`)).resolves.toBe(parseInt('uu1', 36))
})

test('parse_int with valid args is ok, but invalid str for radix', () => {
  return expect(testForValue(`parse_int('uu1', 2);`)).resolves.toBe(parseInt('uu1', 2))
})

test('parse_int with non-string arg str throws error', () => {
  return expect(testFailure(`parse_int(42, 2);`)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."`
  )
})

test('parse_int with non-integer arg radix throws error', () => {
  return expect(testFailure(`parse_int(42, 2.1);`)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."`
  )
})

test('parse_int with radix outside [2, 36] throws error, radix=1', () => {
  return expect(testFailure(`parse_int('10', 1);`)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."`
  )
})

test('parse_int with radix outside [2, 36] throws error, radix=37', () => {
  return expect(testFailure(`parse_int('10', 37);`)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."`
  )
})

test('parse_int with string arg radix throws error', () => {
  return expect(testFailure(`parse_int(42, '2');`)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."`
  )
})

test('char_at with non string first argument errors', () => {
  return expect(testFailure(`char_at(42, 123);`)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: char_at expects the first argument to be a string."`
  )
})

test('char_at with non nonnegative integer second argument errors', () => {
  return expect(testFailure(`char_at('', -1);`)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: char_at expects the second argument to be a nonnegative integer."`
  )
})

test('char_at with string as second argument errors', () => {
  return expect(testFailure(`char_at('', "");`)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: char_at expects the second argument to be a nonnegative integer."`
  )
})

test('char_at with valid args is ok', () => {
  return expect(testForValue(`char_at("123", 0);`)).resolves.toBe('1')
})

test('char_at with valid args (but index out of bounds) returns undefined', () => {
  return expect(testForValue(`char_at("123", 3);`)).resolves.toBe(undefined)
})

test('arity with nullary function is ok', () => {
  return expect(testForValue(`arity(math_random);`)).resolves.toBe(0)
})

test('arity with function with parameters is ok', () => {
  return expect(testForValue(`arity(arity);`)).resolves.toBe(1)
})

test('arity ignores the rest parameter', () => {
  return expect(testForValue(`arity(display);`)).resolves.toBe(1)
})

test('arity with user-made function is ok', () => {
  return expect(
    testForValue(
      stripIndent`
    function test(x, y) {
      return x + y;
    }
    arity(test);
  `,
      { chapter: Chapter.SOURCE_1 }
    )
  ).resolves.toBe(2)
})

test('arity with user-made lambda function is ok', () => {
  return expect(testForValue(`arity(x => x);`)).resolves.toBe(1)
})

test('arity with user-made nullary function is ok', () => {
  return expect(testForValue(`arity(() => undefined);`)).resolves.toBe(0)
})

test('arity with user-made function with rest parameter is ok', () => {
  return expect(
    testForValue(
      stripIndent`
    function test(...xs) {
      return xs;
    }
    arity(test);
  `,
      { chapter: Chapter.SOURCE_3 }
    )
  ).resolves.toBe(0)
})

test('arity with non-function arg f throws error', () => {
  return expect(testFailure(`arity('function');`)).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: arity expects a function as argument"`
  )
})
