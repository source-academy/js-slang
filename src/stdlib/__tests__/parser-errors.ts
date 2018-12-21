import { expectParsedError, stripIndent } from '../../utils/testing'

test('Blatant syntax error', () => {
  return expectParsedError(
    stripIndent`
    stringify(parse("'"), undefined, 2);
  `,
    4
  ).toMatchInlineSnapshot(`"Line 1: ParseError: SyntaxError: Unterminated string constant (1:0)"`)
})

test('Blacklisted syntax', () => {
  return expectParsedError(
    stripIndent`
    stringify(parse("function* f() { yield 1; } f();"), undefined, 2);
  `,
    4
  ).toMatchInlineSnapshot(`"Line 1: ParseError: Yield expressions are not allowed"`)
})

test('Syntax rules', () => {
  return expectParsedError(
    stripIndent`
    stringify(parse("x = y = x;"), undefined, 2);
  `,
    4
  ).toMatchInlineSnapshot(
    `"Line 1: ParseError: Assignment inside an expression is not allowed. Only assignment in a statement is allowed."`
  )
})
