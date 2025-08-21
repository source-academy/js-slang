import { expect, test } from 'vitest'
import { Chapter, Variant } from '../../langs'
import { testFailure, testForValue } from '../../utils/testing'

// apply tests for Scheme
const optionECScm = { chapter: Chapter.FULL_SCHEME, variant: Variant.EXPLICIT_CONTROL }

test('two-operand apply', () => {
  return expect(testForValue(
    `
    (define args '(1 2))
    (apply + args)
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 3n,
            }
          `)
})

test('multi-operand apply', () => {
  return expect(testForValue(
    `
    (define args '(1 2 3 4 5))
    (apply + 6 7 8 9 10 args)
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 55n,
            }
          `)
})

test('eval of strings', () => {
  return expect(testForValue(
    `
    (eval "hello")
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"hello"`)
})

test('incorrect use of apply throws error (insufficient arguments)', () => {
  return expect(testFailure(
    `
    (apply)
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Expected 2 arguments, but got 0."`)
})

test('incorrect use of apply throws error (last argument not a list)', () => {
  return expect(testFailure(
    `
    (apply + 1 2 3)
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: Last argument of apply must be a list"`)
})
