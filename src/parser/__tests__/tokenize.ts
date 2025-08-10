import { expect, test } from 'vitest';
import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { testFailure, testSuccess } from '../../utils/testing';

test('tokenize works for a good program', async () => {
  const { context } = await testSuccess(
    'display_list(tokenize(' +
      JSON.stringify(stripIndent`
      function f(x) {
        const y = x + x + x + "123";
        return z => (a, b) => {
          let w = z + 1;
          return y;
        };
      }
      f("55");
      `) +
      '));',
    Chapter.SOURCE_4
  )

  expect(context.displayResult)
    .toMatchInlineSnapshot(`
Array [
  "list(\\"function\\",
     \\"f\\",
     \\"(\\",
     \\"x\\",
     \\")\\",
     \\"{\\",
     \\"const\\",
     \\"y\\",
     \\"=\\",
     \\"x\\",
     \\"+\\",
     \\"x\\",
     \\"+\\",
     \\"x\\",
     \\"+\\",
     \\"\\\\\\"123\\\\\\"\\",
     \\";\\",
     \\"return\\",
     \\"z\\",
     \\"=>\\",
     \\"(\\",
     \\"a\\",
     \\",\\",
     \\"b\\",
     \\")\\",
     \\"=>\\",
     \\"{\\",
     \\"let\\",
     \\"w\\",
     \\"=\\",
     \\"z\\",
     \\"+\\",
     \\"1\\",
     \\";\\",
     \\"return\\",
     \\"y\\",
     \\";\\",
     \\"}\\",
     \\";\\",
     \\"}\\",
     \\"f\\",
     \\"(\\",
     \\"\\\\\\"55\\\\\\"\\",
     \\")\\",
     \\";\\")",
]
`)
})

test('tokenize works even with parse errors', async () => {
  const { context } = await testSuccess(
    'display_list(tokenize(' +
      JSON.stringify(stripIndent`
      function f(x) {
      ;;;;;;;
      `) +
      '));',
    Chapter.SOURCE_4
  )
  expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "list(\\"function\\", \\"f\\", \\"(\\", \\"x\\", \\")\\", \\"{\\", \\";\\", \\";\\", \\";\\", \\";\\", \\";\\", \\";\\", \\";\\")",
]
`)
})

test('tokenize prints suitable error when tokenization fails', () => {
  return expect(testFailure('display_list(tokenize("\\""));', Chapter.SOURCE_4)).toMatchInlineSnapshot(`"Line 1: SyntaxError: Unterminated string constant (1:0)"`)
})
