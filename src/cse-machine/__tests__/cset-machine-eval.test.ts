import { test } from 'vitest'
import { Chapter, Variant } from '../../langs'
import { expectParsedError, expectFinishedResult, testSuccess } from '../../utils/testing'

// CSET tests for Scheme
const optionECScm = { chapter: Chapter.FULL_SCHEME, variant: Variant.EXPLICIT_CONTROL }

test('eval of numbers', async ({ expect }) => {
  const {
    result: { value }
  } = await testSuccess(`(eval 1)`, optionECScm)
  expect(value).toMatchInlineSnapshot(`
    SchemeInteger {
      "numberType": 1,
      "value": 1n,
    }
  `)
})

test('eval of booleans', () => {
  return expectFinishedResult(`(eval #t)`, optionECScm).toEqual(true)
})

test('eval of strings', () => {
  return expectFinishedResult(`(eval "hello")`, optionECScm).toEqual('hello')
})

test('eval of symbols', async ({ expect }) => {
  const {
    result: { value }
  } = await testSuccess(
    `
    (define hello 1)
    (eval 'hello)
  `,
    optionECScm
  )

  expect(value).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of empty list', () => {
  return expectParsedError(`(eval '())`, optionECScm).toEqual('Error: Cannot evaluate null')
})

test('eval of define', async ({ expect }) => {
  const {
    result: { value }
  } = await testSuccess(
    `
    (eval '(define x 1))
    x
  `,
    optionECScm
  )

  expect(value).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of lambda', async ({ expect }) => {
  const {
    result: { value }
  } = await testSuccess(
    `
    (eval '(lambda (x) x))
  `,
    optionECScm
  )
  expect(value).toMatchInlineSnapshot(`[Function]`)
})

test('eval of if', async ({ expect }) => {
  const {
    result: { value }
  } = await testSuccess(
    `
    (eval '(if #t 1 2))
  `,
    optionECScm
  )

  expect(value).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of begin', async ({ expect }) => {
  const {
    result: { value }
  } = await testSuccess(
    `
    (eval '(begin 1 2 3))
  `,
    optionECScm
  )

  expect(value).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 3n,
            }
          `)
})

test('eval of set!', async ({ expect }) => {
  const {
    result: { value }
  } = await testSuccess(
    `
    (define x 2)
    (eval '(set! x 1))
    x
  `,
    optionECScm
  )

  expect(value).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 1n,
            }
          `)
})

test('eval of application', async ({ expect }) => {
  const {
    result: { value }
  } = await testSuccess(
    `
    (eval '(+ 1 2))
  `,
    optionECScm
  )

  expect(value).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 3n,
            }
          `)
})

test('eval of quote', async ({ expect }) => {
  const {
    result: { value }
  } = await testSuccess(
    `
    (eval '(quote (1 2 3)))
  `,
    optionECScm
  )

  expect(value).toMatchInlineSnapshot(`
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
