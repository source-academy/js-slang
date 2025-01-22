import { Chapter, Variant } from '../../types'
import { expectParsedError, expectResult } from '../../utils/testing'

// CSET tests for Scheme Macros
const optionECScm = { chapter: Chapter.FULL_SCHEME, variant: Variant.EXPLICIT_CONTROL }

test('definition of a macro', () => {
  return expectResult(
    `
    (define-syntax my-let
      (syntax-rules ()
        ((_ ((var expr) ...) body ...)
         ((lambda (var ...) body ...) expr ...))))
    `,
    optionECScm
  ).toMatchInlineSnapshot(`undefined`)
})

test('use of a macro', () => {
  return expectResult(
    `
    (define-syntax my-let
      (syntax-rules ()
        ((_ ((var expr) ...) body ...)
         ((lambda (var ...) body ...) expr ...))))
    (my-let ((x 1) (y 2))
      (+ x y))
    `,
    optionECScm
  ).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 3n,
            }
          `)
})

test('use of a more complex macro (recursive)', () => {
  return expectResult(
    `
(define-syntax define-match
    (syntax-rules ()
        ; vars is a pair
        ((_ (front . rest) val)
         (begin
            (if (not (pair? val))
                (error "define-match: vars and vals do not match"))
            (define-match front (car val))
            (define-match rest (cdr val))))
        ; vars is nil
        ((_ () val)
         ; do nothing
         (if #f #f))
        ; vars is a single symbol
        ((_ sym val)
         (define sym val))))
  (define-match ((x y) z) '((1 2) 3))
  (+ x y z)
    `,
    optionECScm
  ).toMatchInlineSnapshot(`
            SchemeInteger {
              "numberType": 1,
              "value": 6n,
            }
          `)
})

test('failed usage of a macro (no matching pattern)', () => {
  return expectParsedError(
    `
    (define-syntax my-let
      (syntax-rules ()
        ((_ ((var expr) ...) body ...)
         ((lambda (var ...) body ...) expr ...))))
    (my-let ((x 1) y)
      (+ x y))
    `,
    optionECScm
  ).toMatchInlineSnapshot(`"Error: No matching transformer found for macro my-let"`)
})
