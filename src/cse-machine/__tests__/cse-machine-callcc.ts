import { Chapter, Variant } from '../../types'
import { expectResult } from '../../utils/testing'

// as continuations mostly target the scheme implementation, we will test continuations
// using a scheme context.
const optionECScm = { chapter: Chapter.FULL_SCHEME, variant: Variant.EXPLICIT_CONTROL }

test('basic call/cc works', () => {
  return expectResult(
    `
    (+ 1 2 (call/cc (lambda (k) (k 3))) 4)
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

test('call/cc can be stored as a value', () => {
  return expectResult(
    `
    ;; storing a continuation and calling it
    (define a #f)

    (+ 1 2 3 (call/cc (lambda (k) (set! a k))) 4 5)

    ;; as continuations are represented with dummy 
    ;; identity functions, we should not expect to see 6
    (a 6)
    `,
    optionECScm
  ).toMatchInlineSnapshot(`21`)
})

// test('even when stored as a value, calling a continuation should alter the execution flow', () => {
//   return expectResult(
//     `
//     ;; storing a continuation and calling it
//     (define a #f)

//     (+ 1 2 3 (call/cc (lambda (k) (set! a k))) 4 5)

//     ;; the following addition should be ignored

//     (+ (a 6) 7)
//     `,
//     optionECScm
//   ).toMatchInlineSnapshot(`21`)
// })