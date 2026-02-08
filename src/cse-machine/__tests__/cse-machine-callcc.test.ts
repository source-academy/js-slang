import { test } from 'vitest'
import { Chapter, Variant } from '../../langs'
import { expectFinishedResult, expectParsedError, testSuccess } from '../../utils/testing'

// Continuation tests for Scheme
const optionECScm = { chapter: Chapter.SCHEME_4, variant: Variant.EXPLICIT_CONTROL }

test('basic call/cc works', async ({ expect }) => {
  const {
    result: { value }
  } = await testSuccess(
    `
    (+ 1 2 (call/cc
              (lambda (k) (k 3)))
            4)
  `,
    optionECScm
  )
  expect(value).toMatchInlineSnapshot(`
SchemeInteger {
  "numberType": 1,
  "value": 10n,
}
`)
})

test('call/cc can be used to escape a computation', async ({ expect }) => {
  const {
    result: { value }
  } = await testSuccess(
    `
    (define test 1)
    (call/cc (lambda (k)
                (set! test 2)
                (k 'escaped)
                (set! test 3)))
    ;; test should be 2
    test
  `,
    optionECScm
  )
  expect(value).toMatchInlineSnapshot(`
SchemeInteger {
  "numberType": 1,
  "value": 2n,
}
`)
})

test('call/cc throws error given no arguments', () => {
  return expectParsedError(
    `
    (+ 1 2 (call/cc) 4)
  `,
    optionECScm
  ).toEqual('Line 2: Expected 1 arguments, but got 0.')
})

test('call/cc throws error given >1 argument', () => {
  return expectParsedError(
    `
    (+ 1 2 (call/cc
              (lambda (k) (k 3))
              'wrongwrongwrong!)
            4)
  `,
    optionECScm
  ).toEqual('Line 2: Expected 1 arguments, but got 2.')
})

/*
for now, continuations have variable arity but are unable to check for the "correct"
number of arguments. we will omit these tests for now
*/
test.todo('cont throws error given no arguments', () => {
  return expectParsedError(
    `
    (+ 1 2 (call/cc
              (lambda (k) (k)))
            4)
  `,
    optionECScm
  ).toEqual('Line 3: Expected 1 arguments, but got 0.')
})

test.todo('cont throws error given >1 argument', () => {
  return expectParsedError(
    `
    (+ 1 2 (call/cc
              (lambda (k) (k 3 'wrongwrongwrong!)))
            4)
  `,
    optionECScm
  ).toEqual('Line 3: Expected 1 arguments, but got 2.')
})

test('call/cc can be stored as a value', () => {
  return expectFinishedResult(
    `
    ;; storing a continuation
    (define a #f)

    (+ 1 2 3 (call/cc (lambda (k) (set! a k) 0)) 4 5)

    ;; continuations are treated as functions
    ;; so we can do this:
    (procedure? a)
    `,
    optionECScm
  ).toEqual(true)
})

// both of the following tests generate infinite loops so they are omitted

test.todo('call/cc can be stored as a value and called', () => {
  return expectFinishedResult(
    `
    ;; storing a continuation and calling it
    (define a #f)

    (+ 1 2 3 (call/cc (lambda (k) (set! a k) 0)) 4 5)

    ;; as continuations are represented with dummy
    ;; identity functions, we should not expect to see 6
    (a 6)
    `,
    optionECScm
  ).toEqual(21)
})

test.todo('when stored as a value, calling a continuation should alter the execution flow', () => {
  return expectFinishedResult(
    `
    ;; storing a continuation and calling it
    (define a #f)
    (+ 1 2 3 (call/cc (lambda (k) (set! a k) 0)) 4 5)

    ;; the following addition should be ignored
    (+ 7 (a 6))
    `,
    optionECScm
  ).toEqual(21)
})
