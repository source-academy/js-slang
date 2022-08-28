import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { expectParsedError } from '../../utils/testing'

test('Blatant syntax error', () => {
  return expectParsedError(
    stripIndent`
    stringify(parse("'"), undefined, 2);
    `,
    { chapter: Chapter.SOURCE_4 }
  ).toMatchInlineSnapshot(`"Line 1: ParseError: SyntaxError: Unterminated string constant (1:0)"`)
})

test('Blacklisted syntax', () => {
  return expectParsedError(
    stripIndent`
    stringify(parse("function* f() { yield 1; } f();"), undefined, 2);
    `,
    { chapter: Chapter.SOURCE_4 }
  ).toMatchInlineSnapshot(`"Line 1: ParseError: Yield expressions are not allowed"`)
})
