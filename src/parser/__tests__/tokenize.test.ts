import { test } from 'vitest'
import { Chapter } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { testFailure, testSuccess } from '../../utils/testing'

test.concurrent('tokenize works for a good program', async ({ expect }) => {
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

  expect(context.displayResult).toMatchInlineSnapshot(`
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

test.concurrent('tokenize works even with parse errors', async ({ expect }) => {
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

test.concurrent('tokenize prints suitable error when tokenization fails', ({ expect }) => {
  return expect(
    testFailure('display_list(tokenize("\\""));', Chapter.SOURCE_4)
  ).resolves.toMatchInlineSnapshot(`"Line 1: SyntaxError: Unterminated string constant (1:0)"`)
})
