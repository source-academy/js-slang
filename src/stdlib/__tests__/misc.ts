import { stripIndent } from '../../utils/formatters'
import { expectParsedError, expectResult } from '../../utils/testing'

test('parse_int with valid args is ok, radix 2', () => {
  return expectResult(
    stripIndent`
    parse_int('1100101010101', 2);
  `,
    { chapter: 1, native: true }
  ).toBe(parseInt('1100101010101', 2))
})

test('parse_int with valid args is ok, radix 36', () => {
  return expectResult(
    stripIndent`
    parse_int('uu1', 36);
  `,
    { chapter: 1, native: true }
  ).toBe(parseInt('uu1', 36))
})

test('parse_int with valid args is ok, but invalid str for radix', () => {
  return expectResult(
    stripIndent`
    parse_int('uu1', 2);
  `,
    { chapter: 1, native: true }
  ).toBe(parseInt('uu1', 2))
})

test('parse_int with non-string arg str throws error', () => {
  return expectParsedError(stripIndent`
    parse_int(42, 2);
  `).toMatchInlineSnapshot(
    `"Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."`
  )
})

test('parse_int with non-integer arg radix throws error', () => {
  return expectParsedError(stripIndent`
    parse_int(42, 2.1);
  `).toMatchInlineSnapshot(
    `"Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."`
  )
})

test('parse_int with radix outside [2, 36] throws error, radix=1', () => {
  return expectParsedError(stripIndent`
    parse_int('10', 1);
  `).toMatchInlineSnapshot(
    `"Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."`
  )
})

test('parse_int with radix outside [2, 36] throws error, radix=37', () => {
  return expectParsedError(stripIndent`
    parse_int('10', 37);
  `).toMatchInlineSnapshot(
    `"Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."`
  )
})

test('parse_int with string arg radix throws error', () => {
  return expectParsedError(stripIndent`
    parse_int(42, '2');
  `).toMatchInlineSnapshot(
    `"Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."`
  )
})

test('char_at with non string first argument errors', () => {
  return expectParsedError(stripIndent`
    char_at(42, 123);
  `).toMatchInlineSnapshot(`"Line 1: Error: char_at expects the first argument to be a string."`)
})

test('char_at with non nonnegative integer second argument errors', () => {
  return expectParsedError(stripIndent`
    char_at('', -1);
  `).toMatchInlineSnapshot(
    `"Line 1: Error: char_at expects the second argument to be a nonnegative integer."`
  )
})

test('char_at with non nonnegative integer second argument errors', () => {
  return expectParsedError(stripIndent`
    char_at('', "");
  `).toMatchInlineSnapshot(
    `"Line 1: Error: char_at expects the second argument to be a nonnegative integer."`
  )
})

test('char_at with valid args is ok', () => {
  return expectResult(
    stripIndent`
    char_at("123", 0);
  `
  ).toBe('1')
})

test('char_at with valid args (but index out of bounds) returns undefined', () => {
  return expectResult(
    stripIndent`
    char_at("123", 3);
  `
  ).toBe(undefined)
})
