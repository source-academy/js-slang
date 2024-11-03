import { Chapter, Variant } from '../../types'
import { expectParsedError, expectResult } from '../../utils/testing'

// CSEP tests for Scheme
const optionECScm = { chapter: Chapter.FULL_SCHEME, variant: Variant.EXPLICIT_CONTROL }

test('eval of numbers', () => {
  return expectResult(
    `
    (eval 1)
  `,
    optionECScm
  ).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of booleans', () => {
  return expectResult(
    `
    (eval #t)
  `,
    optionECScm
  ).toMatchInlineSnapshot(`true`)
})

test('eval of strings', () => {
  return expectResult(
    `
    (eval "hello")
  `,
    optionECScm
  ).toMatchInlineSnapshot(`"hello"`)
})

test('eval of symbols', () => {
  return expectResult(
    `
    (define hello 1)
    (eval 'hello)
  `,
    optionECScm
  ).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of empty list', () => {
  return expectParsedError(
    `
    (eval '())
  `,
    optionECScm
  ).toMatchInlineSnapshot(`"Error: Cannot evaluate null"`)
})

test('eval of define', () => {
  return expectResult(
    `
    (eval '(define x 1))
    x
  `,
    optionECScm
  ).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of lambda', () => {
  return expectResult(
    `
    (eval '(lambda (x) x))
  `,
    optionECScm
  ).toMatchInlineSnapshot(`[Function]`)
})

test('eval of if', () => {
  return expectResult(
    `
    (eval '(if #t 1 2))
  `,
    optionECScm
  ).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of begin', () => {
  return expectResult(
    `
    (eval '(begin 1 2 3))
  `,
    optionECScm
  ).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 3n,
            }
          `)
})

test('eval of set!', () => {
  return expectResult(
    `
    (define x 2)
    (eval '(set! x 1))
    x
  `,
    optionECScm
  ).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of application', () => {
  return expectResult(
    `
    (eval '(+ 1 2))
  `,
    optionECScm
  ).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 3n,
            }
          `)
})

test('eval of quote', () => {
  return expectResult(
    `
    (eval '(quote (1 2 3)))
  `,
    optionECScm
  ).toMatchInlineSnapshot(`
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
