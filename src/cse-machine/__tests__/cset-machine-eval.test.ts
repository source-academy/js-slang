import { expect, test } from 'vitest'
import { Chapter, Variant } from '../../langs'
import { testFailure, testForValue } from '../../utils/testing'

// CSET tests for Scheme
const optionECScm = { chapter: Chapter.FULL_SCHEME, variant: Variant.EXPLICIT_CONTROL }

test('eval of numbers', () => {
  return expect(testForValue(
    `
    (eval 1)
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of booleans', () => {
  return expect(testForValue(
    `
    (eval #t)
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('eval of strings', () => {
  return expect(testForValue(
    `
    (eval "hello")
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"hello"`)
})

test('eval of symbols', () => {
  return expect(testForValue(
    `
    (define hello 1)
    (eval 'hello)
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of empty list', () => {
  return expect(testFailure(
    `
    (eval '())
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: Cannot evaluate null"`)
})

test('eval of define', () => {
  return expect(testForValue(
    `
    (eval '(define x 1))
    x
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of lambda', () => {
  return expect(testForValue(
    `
    (eval '(lambda (x) x))
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`[Function]`)
})

test('eval of if', () => {
  return expect(testForValue(
    `
    (eval '(if #t 1 2))
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of begin', () => {
  return expect(testForValue(
    `
    (eval '(begin 1 2 3))
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 3n,
            }
          `)
})

test('eval of set!', () => {
  return expect(testForValue(
    `
    (define x 2)
    (eval '(set! x 1))
    x
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of application', () => {
  return expect(testForValue(
    `
    (eval '(+ 1 2))
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 3n,
            }
          `)
})

test('eval of quote', () => {
  return expect(testForValue(
    `
    (eval '(quote (1 2 3)))
  `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`
            Array [
              SchemeInteger {
                "numberType": 1,
                "value": 1n,
              },
              Array [
                SchemeInteger {
                  "numberType": 1,
                  "value": 2n,
                },
                Array [
                  SchemeInteger {
                    "numberType": 1,
                    "value": 3n,
                  },
                  null,
                ],
              ],
            ]
          `)
})
