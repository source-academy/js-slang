import { expectParsedError, expectResult, stripIndent } from '../../utils/testing'

test('parse_int with valid args is ok, radix 2', () => {
  return expectResult(stripIndent`
    parse_int('1100101010101', 2);
  `).toBe(parseInt('1100101010101', 2))
})

test('parse_int with valid args is ok, radix 36', () => {
  return expectResult(stripIndent`
    parse_int('uu1', 36);
  `).toBe(parseInt('uu1', 36))
})

test('parse_int with valid args is ok, but invalid str for radix', () => {
  return expectResult(stripIndent`
    parse_int('uu1', 2);
  `).toBe(parseInt('uu1', 2))
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
