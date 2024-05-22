import { Chapter, Variant } from '../../types'
import { stripIndent } from '../../utils/formatters'
import {
  expectResult,
  expectParsedErrorsToEqual,
  expectResultsToEqual
} from '../../utils/testing'
// Continuation tests for Source
const optionEC4 = { chapter: Chapter.SOURCE_4, variant: Variant.EXPLICIT_CONTROL }

expectResultsToEqual(
  [
    ['call_cc works with normal functions', '1 + 2 + call_cc((cont) => 3) + 4;', 10],
    [
      'call_cc can be used to return early',
      `
      let x = 1;
      call_cc((cont) => {
          x = 2;
          cont();
          x = 3;
      });
      x;
    `,
      2
    ]
  ],
  optionEC4
)

expectParsedErrorsToEqual(
  [
    [
      'call_cc throws error when given no arguments',
      '1 + 2 + call_cc() + 4;',
      'Line 1: Expected 1 arguments, but got 0.'
    ],
    [
      'call_cc throws error when given > 1 arguments',
      `
      const f = (cont) => cont;
      1 + 2 + call_cc(f,f) + 4;
    `,
      'Line 3: Expected 1 arguments, but got 2.'
    ]
  ],
  optionEC4
)

test('continuations can be stored as a value', () => {
  return expectResult(
    stripIndent`
        let a = 0;
        call_cc((cont) => {
            a = cont;
        });
        a;
        `,
    optionEC4
  ).toMatchInlineSnapshot(`[Function]`)
})
