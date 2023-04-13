import { Chapter, Value } from '../types'
import { stripIndent } from '../utils/formatters'
import { expectResult, snapshotFailure } from '../utils/testing'

test.each([
  // Scheme 1

  // Equality predicates
  [
    Chapter.SCHEME_1,
    `
    (eq? "a" "a")
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (eq? "a" "b")
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_2,
    `
    (eq? '(1 2 3) '(1 2 3))
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_2,
    `
    (eqv? '(1 2 3) '(1 2 3))
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (equal? 1 "1")
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_2,
    `
    (equal? '(1 2 3) '(1 2 3))
    `,
    true,
    true
  ],

  // Basic arithmetic
  [
    Chapter.SCHEME_1,
    `
    (+)
    `,
    true,
    0
  ],

  [
    Chapter.SCHEME_1,
    `
    (+ 1 2 3)
    `,
    true,
    6
  ],

  [
    Chapter.SCHEME_1,
    `
    (- 1)
    `,
    true,
    -1
  ],

  [
    Chapter.SCHEME_1,
    `
    (- 1 2)
    `,
    true,
    -1
  ],

  [
    Chapter.SCHEME_1,
    `
    (*)
    `,
    true,
    1
  ],

  [
    Chapter.SCHEME_1,
    `
    (* 1 2 3)
    `,
    true,
    6
  ],

  [
    Chapter.SCHEME_1,
    `
    (/ 1 2)
    `,
    true,
    0.5
  ],

  // Arithmetic comparisons

  [
    Chapter.SCHEME_1,
    `
    (= 1 1)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (= 1 2)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (< 1 2)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (< 1 2 2)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (> 1 2)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (> 3 2 1)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (<= 1 2)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (<= 1 2 2)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (>= 1 2)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (>= 3 2 1)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (>= 3 2 2)
    `,
    true,
    true
  ],

  // Math functions

  [
    Chapter.SCHEME_1,
    `
    (number? 1)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (number? "1")
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (real? 1)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (integer? 1)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (integer? 1.1)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (exact? 1.1)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (exact-integer? 1)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (exact-integer? 1.1)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (zero? 0)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (zero? 1)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (positive? 1)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (positive? 0)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (negative? -1)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (negative? 0)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (odd? 1)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (odd? 2)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (even? 2)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (even? 1)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (max 1 2 3)
    `,
    true,
    3
  ],

  [
    Chapter.SCHEME_1,
    `
    (max)
    `,
    true,
    -Infinity
  ],

  [
    Chapter.SCHEME_1,
    `
    (min)
    `,
    true,
    Infinity
  ],

  [
    Chapter.SCHEME_1,
    `
    (min 1 2 3)
    `,
    true,
    1
  ],

  [
    Chapter.SCHEME_1,
    `
    (abs -1)
    `,
    true,
    1
  ],

  [
    Chapter.SCHEME_1,
    `
    (abs 1)
    `,
    true,
    1
  ],

  [
    Chapter.SCHEME_1,
    `
    (quotient 5 2)
    `,
    true,
    2
  ],

  [
    Chapter.SCHEME_1,
    `
    (quotient 5 2.5)
    `,
    true,
    2
  ],

  [
    Chapter.SCHEME_1,
    `
    (quotient 5 -2)
    `,
    true,
    -2
  ],

  [
    Chapter.SCHEME_1,
    `
    (modulo 5 2)
    `,
    true,
    1
  ],

  [
    Chapter.SCHEME_1,
    `
    (modulo 5 1)
    `,
    true,
    0
  ],

  [
    Chapter.SCHEME_1,
    `
    (remainder 5 2)
    `,
    true,
    1
  ],

  [
    Chapter.SCHEME_1,
    `
    (remainder 5 1)
    `,
    true,
    0
  ],

  [
    Chapter.SCHEME_1,
    `
    (gcd 32 4110 22)
    `,
    true,
    2
  ],

  [
    Chapter.SCHEME_1,
    `
    (lcm 32 4110 22)
    `,
    true,
    723360
  ],

  [
    Chapter.SCHEME_1,
    `
    (floor 1.1)
    `,
    true,
    1
  ],

  [
    Chapter.SCHEME_1,
    `
    (ceiling 1.1)
    `,
    true,
    2
  ],

  [
    Chapter.SCHEME_1,
    `
    (truncate 1.6)
    `,
    true,
    1
  ],

  [
    Chapter.SCHEME_1,
    `
    (truncate 1.1)
    `,
    true,
    1
  ],

  [
    Chapter.SCHEME_1,
    `
    (round 1.1)
    `,
    true,
    1
  ],

  [
    Chapter.SCHEME_1,
    `
    (round 1.6)
    `,
    true,
    2
  ],

  [
    Chapter.SCHEME_1,
    `
    (square 4)
    `,
    true,
    16
  ],

  [
    Chapter.SCHEME_1,
    `
    (exact-integer-sqrt 16)
    `,
    true,
    4
  ],

  [
    Chapter.SCHEME_1,
    `
    (expt 2 3)
    `,
    true,
    8
  ],

  [
    Chapter.SCHEME_1,
    `
    (number->string 1)
    `,
    true,
    '1'
  ],

  // Booleans

  [
    Chapter.SCHEME_1,
    `
    (boolean? (= 0 0))
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (boolean? 0)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (and #t #t #t)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (and #t #f #t)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (or #f #f #t)
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (or #f #f #f)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (not #t)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (not #f)
    `,
    true,
    true
  ],

  // Strings

  [
    Chapter.SCHEME_1,
    `
    (string? "abc")
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (string? 1)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (make-string 3)
    `,
    true,
    '   '
  ],

  [
    Chapter.SCHEME_1,
    `
    (make-string 3 "a")
    `,
    true,
    'aaa'
  ],

  [
    Chapter.SCHEME_1,
    `
    (string "hi" " " "mum")
    `,
    true,
    'hi mum'
  ],

  [
    Chapter.SCHEME_1,
    `
    (string-length "abc")
    `,
    true,
    3
  ],

  [
    Chapter.SCHEME_1,
    `
    (string-ref "abc" 1)
    `,
    true,
    'b'
  ],

  [
    Chapter.SCHEME_1,
    `
    (string=? "abc" "abc")
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (string=? "abc" "def")
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (string<? "abc" "def")
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (string<? "def" "abc")
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (string>? "abc" "def")
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (string>? "def" "abc")
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (string<=? "abc" "abc")
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (string<=? "abc" "def")
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (string<=? "def" "abc")
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (string>=? "abc" "abc")
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (string>=? "def" "abc")
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (string>=? "abc" "def")
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_1,
    `
    (substring "abc" 1)
    `,
    true,
    'bc'
  ],

  [
    Chapter.SCHEME_1,
    `
    (substring "abc" 1 2)
    `,
    true,
    'b'
  ],

  [
    Chapter.SCHEME_1,
    `
    (string-append "a" "b" "c")
    `,
    true,
    'abc'
  ],

  [
    Chapter.SCHEME_1,
    `
    (string->number "123")
    `,
    true,
    123
  ],

  // Procedures

  [
    Chapter.SCHEME_1,
    `
    (procedure? (lambda (a) a))
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_1,
    `
    (procedure? 1)
    `,
    true,
    false
  ],

  // Scheme 2

  // Pairs

  [
    Chapter.SCHEME_2,
    `
    (pair? (cons 1 2))
    `,
    true,
    true
  ],

  // FAILS 7 BELOW

  [
    Chapter.SCHEME_2,
    `
    (pair? 1)
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_2,
    `
    (car (cons 1 2))
    `,
    true,
    1
  ],

  [
    Chapter.SCHEME_2,
    `
    (cdr (cons 1 2))
    `,
    true,
    2
  ],

  [
    Chapter.SCHEME_2,
    `
    (list? (list 1 2 3))
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_2,
    `
    (list? (cons 1 2))
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_2,
    `
    (null? (list))
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_2,
    `
    (null? (cons 1 2))
    `,
    true,
    false
  ],

  [
    Chapter.SCHEME_2,
    `
    (length (list 1 2 3))
    `,
    true,
    3
  ],

  [
    Chapter.SCHEME_2,
    `
    (length (list))
    `,
    true,
    0
  ],

  [
    Chapter.SCHEME_2,
    `
    (list-ref (list 1 2 3) 1)
    `,
    true,
    2
  ],

  /* FAILS. Issue with the interepreter detecting wrong arity of lambda functions: 0

  [
    Chapter.SCHEME_2,
    `
    (fold (lambda (a b) (string-append a b)) "" (list "a" "b" "c"))
    `,
    true,
    'abc'
  ],

  [
    Chapter.SCHEME_2,
    `
    (fold (lambda (a b) (+ a b)) 0 (list))
    `,
    true,
    0
  ],

  [
    Chapter.SCHEME_2,
    `
    (fold (lambda (a b) (+ a b)) 0 (list 1))
    `,
    true,
    1
  ],

  [
    Chapter.SCHEME_2,
    `
    (fold-right (lambda (a b) (string-append a b)) "" (list "a" "b" "c"))
    `,
    true,
    'cba'
  ],

  [
    Chapter.SCHEME_2,
    `
    (fold-right (lambda (a b) (+ a b)) 0 (list))
    `,
    true,
    0
  ],

  [
    Chapter.SCHEME_2,
    `
    (reduce (lambda (a b) (string-append a b)) "" (list "a" "b" "c"))
    `,
    true,
    'abc'
  ],

  */

  // Lists

  // Symbols

  // Strings

  [
    Chapter.SCHEME_2,
    `
    (list->string '("a" "b" "c"))
    `,
    true,
    'abc'
  ],

  [
    Chapter.SCHEME_2,
    `
    (list->string (string->list "abc"))
    `,
    true,
    'abc'
  ],

  // Scheme 3

  // Pair mutation

  // List mutation

  // Promises

  [
    Chapter.SCHEME_3,
    `
    (promise? (delay 1))
    `,
    true,
    true
  ],

  [
    Chapter.SCHEME_3,
    `
    (promise? 1)
    `,
    true,
    false
  ],

  /* FAILS. Some issues involving the interpreter detecting wrong arity of lambda functions: 0

  [
    Chapter.SCHEME_3,
    `
    (promise? (lambda (a) a))
    `,
    true,
    false
  ],

  */

  [
    Chapter.SCHEME_3,
    `
    (force (delay 1))
    `,
    true,
    1
  ],

  // Scheme 4

  [
    Chapter.SCHEME_4,
    `
    (apply + 1 2 3 4 '(5 6 7 8))
    `,
    true,
    36
  ],

  [
    Chapter.SCHEME_4,
    `
    (apply + '(5 6 7 8))
    `,
    true,
    26
  ]
] as [Chapter, string, boolean, Value][])(
  'Builtins work as expected %#',
  (chapter: Chapter, snippet: string, passing: boolean, returnValue: Value) => {
    if (passing) {
      return expectResult(stripIndent(snippet), {
        chapter,
        native: true
      }).toEqual(returnValue)
    } else {
      return snapshotFailure(stripIndent(snippet), { chapter }, 'fails')
    }
  }
)
