import { expect, test } from 'vitest'
import { Chapter } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { testFailure } from '../../utils/testing'

test('Blatant syntax error', () => {
  return expect(testFailure(
    stripIndent`
    stringify(parse("'"), undefined, 2);
    `,
    { chapter: Chapter.SOURCE_4 }
  )).resolves.toMatchInlineSnapshot(`"Line 1: ParseError: SyntaxError: Unterminated string constant (1:0)"`)
})

test('Blacklisted syntax', () => {
  return expect(testFailure(
    stripIndent`
    stringify(parse("function* f() { yield 1; } f();"), undefined, 2);
    `,
    { chapter: Chapter.SOURCE_4 }
  )).resolves.toMatchInlineSnapshot(`"Line 1: ParseError: Yield expressions are not allowed"`)
})
