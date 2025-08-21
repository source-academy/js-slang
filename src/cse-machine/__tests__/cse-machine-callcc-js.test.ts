import { expect, test } from 'vitest'
import { Chapter, Variant } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { testFailure, testForValue } from '../../utils/testing'
// Continuation tests for Source
const optionEC4 = { chapter: Chapter.SOURCE_4, variant: Variant.EXPLICIT_CONTROL }

test('call_cc works with normal functions', () => {
  return expect(testForValue(`1 + 2 + call_cc((cont) => 3) + 4; `, optionEC4)).resolves.toEqual(10)
})

test('call_cc can be used to return early', () => {
  return expect(
    testForValue(
      stripIndent`
        let x = 1;
        call_cc((cont) => {
            x = 2;
            cont();
            x = 3;
        });
        x;
        `,
      optionEC4
    )
  ).resolves.toEqual(2)
})

test('call_cc throws error when given no arguments', () => {
  return expect(testFailure(`1 + 2 + call_cc() + 4;`, optionEC4)).resolves.toMatchInlineSnapshot(`"Line 1: Expected 1 arguments, but got 0."`)
})

test('call_cc throws error when given > 1 arguments', () => {
  return expect(
    testFailure(
      stripIndent`
        const f = (cont) => cont;
        1 + 2 + call_cc(f,f) + 4;
        `,
      optionEC4
    )
  ).resolves.toMatchInlineSnapshot(`"Line 2: Expected 1 arguments, but got 2."`)
})

test('continuations can be stored as a value', () => {
  return expect(
    testForValue(
      stripIndent`
        let a = 0;
        call_cc((cont) => {
            a = cont;
        });
        a;
        `,
      optionEC4
    )
  ).resolves.toMatchInlineSnapshot(`[Function]`)
})
