import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { expectDisplayResult, expectParsedError } from '../../utils/testing'

test('tokenize works for a good program', () => {
  return expectDisplayResult(
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
    { chapter: Chapter.SOURCE_4 }
  ).toMatchInlineSnapshot(`
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

test('tokenize works even with parse errors', () => {
  return expectDisplayResult(
    'display_list(tokenize(' +
      JSON.stringify(stripIndent`
      function f(x) {
      ;;;;;;;
      `) +
      '));',
    { chapter: Chapter.SOURCE_4 }
  ).toMatchInlineSnapshot(`
            Array [
              "list(\\"function\\", \\"f\\", \\"(\\", \\"x\\", \\")\\", \\"{\\", \\";\\", \\";\\", \\";\\", \\";\\", \\";\\", \\";\\", \\";\\")",
            ]
          `)
})

test('tokenize prints suitable error when tokenization fails', () => {
  return expectParsedError('display_list(tokenize("\\""));', {
    chapter: Chapter.SOURCE_4
  }).toMatchInlineSnapshot(`"Line 1: SyntaxError: Unterminated string constant (1:0)"`)
})
