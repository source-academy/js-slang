import { test } from 'vitest'
import { Chapter, Variant } from '../../types'
import { expectParsedError, expectFinishedResult } from '../../utils/testing'

// apply tests for Scheme
const optionECScm = { chapter: Chapter.FULL_SCHEME, variant: Variant.EXPLICIT_CONTROL }

test('two-operand apply', () => {
  return expectFinishedResult(
    `
    (define args '(1 2))
    (apply + args)
  `,
    optionECScm
  ).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 3n,
            }
          `)
})

test('multi-operand apply', () => {
  return expectFinishedResult(
    `
    (define args '(1 2 3 4 5))
    (apply + 6 7 8 9 10 args)
  `,
    optionECScm
  ).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 55n,
            }
          `)
})

test('eval of strings', () => {
  return expectFinishedResult(
    `
    (eval "hello")
  `,
    optionECScm
  ).toMatchInlineSnapshot(`"hello"`)
})

test('incorrect use of apply throws error (insufficient arguments)', () => {
  return expectParsedError(
    `
    (apply)
  `,
    optionECScm
  ).toMatchInlineSnapshot(`"Expected 2 arguments, but got 0."`)
})

test('incorrect use of apply throws error (last argument not a list)', () => {
  return expectParsedError(
    `
    (apply + 1 2 3)
  `,
    optionECScm
  ).toMatchInlineSnapshot(`"Error: Last argument of apply must be a list"`)
})
