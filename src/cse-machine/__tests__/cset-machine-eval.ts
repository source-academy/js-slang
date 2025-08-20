import { Chapter, Variant  } from '../../langs'
import { expectFinishedResult, expectParsedError } from '../../utils/testing'

// CSET tests for Scheme
const optionECScm = { chapter: Chapter.FULL_SCHEME, variant: Variant.EXPLICIT_CONTROL }

test('eval of numbers', () => {
  return expectFinishedResult(
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
  return expectFinishedResult(
    `
    (eval #t)
  `,
    optionECScm
  ).toMatchInlineSnapshot(`true`)
})

test('eval of strings', () => {
  return expectFinishedResult(
    `
    (eval "hello")
  `,
    optionECScm
  ).toMatchInlineSnapshot(`"hello"`)
})

test('eval of symbols', () => {
  return expectFinishedResult(
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
  return expectFinishedResult(
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
  return expectFinishedResult(
    `
    (eval '(lambda (x) x))
  `,
    optionECScm
  ).toMatchInlineSnapshot(`[Function]`)
})

test('eval of if', () => {
  return expectFinishedResult(
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
  return expectFinishedResult(
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
  return expectFinishedResult(
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
  return expectFinishedResult(
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
  return expectFinishedResult(
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
