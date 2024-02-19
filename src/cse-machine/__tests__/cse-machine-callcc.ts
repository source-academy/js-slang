import { Chapter, Variant } from '../../types'
import { expectParsedError, expectResult } from '../../utils/testing'

// as continuations mostly target the scheme implementation, we will test continuations
// using a scheme context.
const optionECScm = { chapter: Chapter.FULL_SCHEME, variant: Variant.EXPLICIT_CONTROL }

test('basic call/cc works', () => {
  return expectResult(
    `
    (+ 1 2 (call/cc
              (lambda (k) (k 3)))
            4)
  `,
    optionECScm
  ).toMatchInlineSnapshot(`10`)
})

test('call/cc can be used to escape a computation', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`2`)
})

test('call/cc throws error given no arguments', () => {
  return expectParsedError(
    `
    (+ 1 2 (call/cc) 4)
  `,
    optionECScm
  ).toMatchInlineSnapshot(`"Line 2: Expected 1 arguments, but got 0."`)
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
  ).toMatchInlineSnapshot(`"Line 2: Expected 1 arguments, but got 2."`)
})

test('cont throws error given no arguments', () => {
  return expectParsedError(
    `
    (+ 1 2 (call/cc
              (lambda (k) (k)))
            4)
  `,
    optionECScm
  ).toMatchInlineSnapshot(`"Line 3: Expected 1 arguments, but got 0."`)
})

test('cont throws error given >1 argument', () => {
  return expectParsedError(
    `
    (+ 1 2 (call/cc
              (lambda (k) (k 3 'wrongwrongwrong!)))
            4)
  `,
    optionECScm
  ).toMatchInlineSnapshot(`"Line 3: Expected 1 arguments, but got 2."`)
})

test('call/cc can be stored as a value', () => {
  return expectResult(
    `
    ;; storing a continuation
    (define a #f)

    (+ 1 2 3 (call/cc (lambda (k) (set! a k) 0)) 4 5)

    ;; continuations are treated as functions
    ;; so we can do this:
    (procedure? a)
    `,
    optionECScm
  ).toMatchInlineSnapshot(`true`)
})

// both of the following tests generate infinite loops so they are omitted

// test('call/cc can be stored as a value and called', () => {
//   return expectResult(
//     `
//     ;; storing a continuation and calling it
//     (define a #f)

//     (+ 1 2 3 (call/cc (lambda (k) (set! a k) 0)) 4 5)

//     ;; as continuations are represented with dummy
//     ;; identity functions, we should not expect to see 6
//     (a 6)
//     `,
//     optionECScm
//   ).toMatchInlineSnapshot(`21`)
// })

// test('when stored as a value, calling a continuation should alter the execution flow', () => {
//   return expectResult(
//     `
//     ;; storing a continuation and calling it
//     (define a #f)
//     (+ 1 2 3 (call/cc (lambda (k) (set! a k) 0)) 4 5)

//     ;; the following addition should be ignored
//     (+ 7 (a 6))
//     `,
//     optionECScm
//   ).toMatchInlineSnapshot(`21`)
// })
