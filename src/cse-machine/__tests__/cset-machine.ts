import { expect, test } from 'vitest'
import { Chapter, Variant  } from '../../langs'
import { testFailure } from '../../utils/testing'

// CSET tests for Scheme (mostly error testing for
// the runtime verification of scheme syntax forms.)
const optionECScm = { chapter: Chapter.FULL_SCHEME, variant: Variant.EXPLICIT_CONTROL }

test('evaluating null throws error', () => {
  return expect(testFailure(
    `
    (eval '())
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: Cannot evaluate null"`)
})

test('evaluating a poorly formed lambda throws error', () => {
  return expect(testFailure(
    `
    (eval '(lambda (1 2 3) x))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: Invalid arguments for lambda!"`)
})

test('evaluating a poorly formed define throws error (insufficient arguments)', () => {
  return expect(testFailure(
    `
    (eval '(define))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: define requires at least 2 arguments!"`)
})

test('evaluating a poorly formed define throws error (too many arguments)', () => {
  return expect(testFailure(
    `
    (eval '(define x 1 2 3))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: define requires 2 arguments!"`)
})

test('evaluating a poorly formed define throws error (ill formed define-function)', () => {
  return expect(testFailure(
    `
    (eval '(define (x 1 2 3) 4))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: Invalid arguments for lambda!"`)
})

test('evaluating a poorly formed define throws error (attempt to redefine special form)', () => {
  return expect(testFailure(
    `
    (eval '(define (if x y) 4))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: Cannot shadow special form if with a definition!"`)
})

test('evaluating a poorly formed set! throws error (insufficient arguments)', () => {
  return expect(testFailure(
    `
    (eval '(set!))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: set! requires 2 arguments!"`)
})

test('evaluating a poorly formed set! throws error (too many arguments)', () => {
  return expect(testFailure(
    `
    (eval '(set! x 1 2 3))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: set! requires 2 arguments!"`)
})

test('evaluating a poorly formed set! throws error (attempt to set! special form)', () => {
  return expect(testFailure(
    `
    (eval '(set! if 4))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: Cannot overwrite special form if with a value!"`)
})

test('evaluating a poorly formed if throws error (insufficient arguments)', () => {
  return expect(testFailure(
    `
    (eval '(if))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: if requires at least 2 arguments!"`)
})

test('evaluating a poorly formed if throws error (too many arguments)', () => {
  return expect(testFailure(
    `
    (eval '(if #t 1 2 3))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: if requires at most 3 arguments!"`)
})

test('evaluating a poorly formed begin throws error (insufficient arguments)', () => {
  return expect(testFailure(
    `
    (eval '(begin))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: begin requires at least 1 argument!"`)
})

test('evaluating a poorly formed quote throws error (insufficient arguments)', () => {
  return expect(testFailure(
    `
    (eval '(quote))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: quote requires 1 argument!"`)
})

test('evaluating a poorly formed quote throws error (too many arguments)', () => {
  return expect(testFailure(
    `
    (eval '(quote x y))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: quote requires 1 argument!"`)
})

test('evaluating a poorly formed define-syntax throws error (insufficient arguments)', () => {
  return expect(testFailure(
    `
    (eval '(define-syntax))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: define-syntax requires 2 arguments!"`)
})

test('evaluating a poorly formed define-syntax throws error (too many arguments)', () => {
  return expect(testFailure(
    `
    (eval '(define-syntax x 1 2 3))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: define-syntax requires 2 arguments!"`)
})

test('evaluating a poorly formed define-syntax throws error (syntax is not a symbol)', () => {
  return expect(testFailure(
    `
    (eval '(define-syntax 1 4))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: define-syntax requires a symbol!"`)
})

test('evaluating a poorly formed define-syntax throws error (attempt to shadow special form)', () => {
  return expect(testFailure(
    `
    (eval '(define-syntax if 4))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: Cannot shadow special form if with a macro!"`)
})

test('evaluating a poorly formed define-syntax throws error (no syntax-rules list)', () => {
  return expect(testFailure(
    `
    (eval '(define-syntax x 1))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: define-syntax requires a syntax-rules transformer!"`)
})

test('evaluating a poorly formed define-syntax throws error (list is not syntax-rules)', () => {
  return expect(testFailure(
    `
    (eval '(define-syntax x (foo bar)))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: define-syntax requires a syntax-rules transformer!"`)
})

test('evaluating a poorly formed define-syntax throws error (syntax-rules too few arguments)', () => {
  return expect(testFailure(
    `
    (eval '(define-syntax x (syntax-rules)))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: syntax-rules requires at least 2 arguments!"`)
})

test('evaluating a poorly formed define-syntax throws error (syntax-rules has poor literals list)', () => {
  return expect(testFailure(
    `
    (eval '(define-syntax x (syntax-rules x (1 1))))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: Invalid syntax-rules literals!"`)
})

test('evaluating a poorly formed define-syntax throws error (syntax-rules has non-symbol literals)', () => {
  return expect(testFailure(
    `
    (eval '(define-syntax x (syntax-rules (1 2) (1 1))))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: Invalid syntax-rules literals!"`)
})

test('evaluating a poorly formed define-syntax throws error (syntax-rules has non-list rules)', () => {
  return expect(testFailure(
    `
    (eval '(define-syntax x (syntax-rules (x) 1)))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: Invalid syntax-rules rule!"`)
})

test('evaluating a syntax-rules expression (should not exist outside of define-syntax)', () => {
  return expect(testFailure(
    `
    (eval '(syntax-rules (x) (1 1)))
    `,
    optionECScm
  )).resolves.toMatchInlineSnapshot(`"Error: syntax-rules must only exist within define-syntax!"`)
})
