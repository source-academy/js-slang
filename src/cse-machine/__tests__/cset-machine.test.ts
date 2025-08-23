import { test } from 'vitest'
import { Chapter, Variant } from '../../langs'
import { expectParsedError } from '../../utils/testing'

// CSET tests for Scheme (mostly error testing for
// the runtime verification of scheme syntax forms.)
const optionECScm = { chapter: Chapter.FULL_SCHEME, variant: Variant.EXPLICIT_CONTROL }

test('evaluating null throws error', () => {
  return expectParsedError(
    `
    (eval '())
    `,
    optionECScm
  ).toEqual('Error: Cannot evaluate null')
})

test('evaluating a poorly formed lambda throws error', () => {
  return expectParsedError(
    `
    (eval '(lambda (1 2 3) x))
    `,
    optionECScm
  ).toEqual('Error: Invalid arguments for lambda!')
})

test('evaluating a poorly formed define throws error (insufficient arguments)', () => {
  return expectParsedError(
    `
    (eval '(define))
    `,
    optionECScm
  ).toEqual('Error: define requires at least 2 arguments!')
})

test('evaluating a poorly formed define throws error (too many arguments)', () => {
  return expectParsedError(
    `
    (eval '(define x 1 2 3))
    `,
    optionECScm
  ).toEqual('Error: define requires 2 arguments!')
})

test('evaluating a poorly formed define throws error (ill formed define-function)', () => {
  return expectParsedError(
    `
    (eval '(define (x 1 2 3) 4))
    `,
    optionECScm
  ).toEqual('Error: Invalid arguments for lambda!')
})

test('evaluating a poorly formed define throws error (attempt to redefine special form)', () => {
  return expectParsedError(
    `
    (eval '(define (if x y) 4))
    `,
    optionECScm
  ).toEqual('Error: Cannot shadow special form if with a definition!')
})

test('evaluating a poorly formed set! throws error (insufficient arguments)', () => {
  return expectParsedError(
    `
    (eval '(set!))
    `,
    optionECScm
  ).toEqual('Error: set! requires 2 arguments!')
})

test('evaluating a poorly formed set! throws error (too many arguments)', () => {
  return expectParsedError(
    `
    (eval '(set! x 1 2 3))
    `,
    optionECScm
  ).toEqual('Error: set! requires 2 arguments!')
})

test('evaluating a poorly formed set! throws error (attempt to set! special form)', () => {
  return expectParsedError(
    `
    (eval '(set! if 4))
    `,
    optionECScm
  ).toEqual('Error: Cannot overwrite special form if with a value!')
})

test('evaluating a poorly formed if throws error (insufficient arguments)', () => {
  return expectParsedError(
    `
    (eval '(if))
    `,
    optionECScm
  ).toEqual('Error: if requires at least 2 arguments!')
})

test('evaluating a poorly formed if throws error (too many arguments)', () => {
  return expectParsedError(
    `
    (eval '(if #t 1 2 3))
    `,
    optionECScm
  ).toEqual('Error: if requires at most 3 arguments!')
})

test('evaluating a poorly formed begin throws error (insufficient arguments)', () => {
  return expectParsedError(
    `
    (eval '(begin))
    `,
    optionECScm
  ).toEqual('Error: begin requires at least 1 argument!')
})

test('evaluating a poorly formed quote throws error (insufficient arguments)', () => {
  return expectParsedError(
    `
    (eval '(quote))
    `,
    optionECScm
  ).toEqual('Error: quote requires 1 argument!')
})

test('evaluating a poorly formed quote throws error (too many arguments)', () => {
  return expectParsedError(
    `
    (eval '(quote x y))
    `,
    optionECScm
  ).toEqual('Error: quote requires 1 argument!')
})

test('evaluating a poorly formed define-syntax throws error (insufficient arguments)', () => {
  return expectParsedError(
    `
    (eval '(define-syntax))
    `,
    optionECScm
  ).toEqual('Error: define-syntax requires 2 arguments!')
})

test('evaluating a poorly formed define-syntax throws error (too many arguments)', () => {
  return expectParsedError(
    `
    (eval '(define-syntax x 1 2 3))
    `,
    optionECScm
  ).toEqual('Error: define-syntax requires 2 arguments!')
})

test('evaluating a poorly formed define-syntax throws error (syntax is not a symbol)', () => {
  return expectParsedError(
    `
    (eval '(define-syntax 1 4))
    `,
    optionECScm
  ).toEqual('Error: define-syntax requires a symbol!')
})

test('evaluating a poorly formed define-syntax throws error (attempt to shadow special form)', () => {
  return expectParsedError(
    `
    (eval '(define-syntax if 4))
    `,
    optionECScm
  ).toEqual('Error: Cannot shadow special form if with a macro!')
})

test('evaluating a poorly formed define-syntax throws error (no syntax-rules list)', () => {
  return expectParsedError(
    `
    (eval '(define-syntax x 1))
    `,
    optionECScm
  ).toEqual('Error: define-syntax requires a syntax-rules transformer!')
})

test('evaluating a poorly formed define-syntax throws error (list is not syntax-rules)', () => {
  return expectParsedError(
    `
    (eval '(define-syntax x (foo bar)))
    `,
    optionECScm
  ).toEqual('Error: define-syntax requires a syntax-rules transformer!')
})

test('evaluating a poorly formed define-syntax throws error (syntax-rules too few arguments)', () => {
  return expectParsedError(
    `
    (eval '(define-syntax x (syntax-rules)))
    `,
    optionECScm
  ).toEqual('Error: syntax-rules requires at least 2 arguments!')
})

test('evaluating a poorly formed define-syntax throws error (syntax-rules has poor literals list)', () => {
  return expectParsedError(
    `
    (eval '(define-syntax x (syntax-rules x (1 1))))
    `,
    optionECScm
  ).toEqual('Error: Invalid syntax-rules literals!')
})

test('evaluating a poorly formed define-syntax throws error (syntax-rules has non-symbol literals)', () => {
  return expectParsedError(
    `
    (eval '(define-syntax x (syntax-rules (1 2) (1 1))))
    `,
    optionECScm
  ).toEqual('Error: Invalid syntax-rules literals!')
})

test('evaluating a poorly formed define-syntax throws error (syntax-rules has non-list rules)', () => {
  return expectParsedError(
    `
    (eval '(define-syntax x (syntax-rules (x) 1)))
    `,
    optionECScm
  ).toEqual('Error: Invalid syntax-rules rule!')
})

test('evaluating a syntax-rules expression (should not exist outside of define-syntax)', () => {
  return expectParsedError(
    `
    (eval '(syntax-rules (x) (1 1)))
    `,
    optionECScm
  ).toEqual('Error: syntax-rules must only exist within define-syntax!')
})
