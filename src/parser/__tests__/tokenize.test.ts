import { test } from 'vitest'
import { Chapter } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { expectParsedError, testSuccess } from '../../utils/testing'

test('tokenize works for a good program', async ({ expect }) => {
  const {
    context: { displayResult }
  } = await testSuccess(
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

  expect(displayResult).toMatchInlineSnapshot(`
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

test('tokenize works even with parse errors', async ({ expect }) => {
  const {
    context: { displayResult }
  } = await testSuccess(
    'display_list(tokenize(' +
      JSON.stringify(stripIndent`
      function f(x) {
      ;;;;;;;
      `) +
      '));',
    { chapter: Chapter.SOURCE_4 }
  )
  expect(displayResult).toMatchInlineSnapshot(`
Array [
  "list(\\"function\\", \\"f\\", \\"(\\", \\"x\\", \\")\\", \\"{\\", \\";\\", \\";\\", \\";\\", \\";\\", \\";\\", \\";\\", \\";\\")",
]
`)
})

test('tokenize prints suitable error when tokenization fails', () => {
  return expectParsedError('display_list(tokenize("\\""));', Chapter.SOURCE_4).toEqual(
    'Line 1: SyntaxError: Unterminated string constant (1:0)'
  )
})
