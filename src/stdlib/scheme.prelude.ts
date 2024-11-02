export const scheme1Prelude = `
;; the basics
(define pi math-pi)
(define e math-e)
`

export const scheme2Prelude = `
;; the bulk of our stuff goes here
(define ($filter pred xs acc)
    (cond 
        ((null? xs) (reverse acc))
        ((pred (car xs)) ($filter pred (cdr xs) (cons (car xs) acc)))
        (else ($filter pred (cdr xs) acc))))

(define (filter pred xs)
    ($filter pred xs '()))

(define ($map f xs acc)
    (if (null? xs)
        (reverse acc)
        ($map f (cdr xs) (cons (f (car xs)) acc))))

(define (map f xs . xss)
    (if (null? xss)
        ($map f xs '())
        ;; if map is variadic, we use the variadic version
        ;; BUT do note that this may not utilise continuations
        ;; properly!
        (apply r7rs-map f (cons xs xss))))

;; fold is defined as fold-left
(define ($fold f acc xs)
    (if (null? xs)
        acc
        ($fold f (f acc (car xs)) (cdr xs))))

(define (fold f init xs . xss)
    (if (null? xss)
        ($fold f init xs)
        (apply r7rs-fold f init (cons xs xss))))

(define (fold-left f init xs . xss)
    (if (null? xss)
        ($fold f init xs)
        (apply r7rs-fold-left f init (cons xs xss))))

(define ($fold-right f init xs cont)
    (if (null? xs)
        (cont init)
        ($fold f init (cdr xs) (lambda (acc) (cont (f (car xs) acc))))))

(define (fold-right f init xs . xss)
    (if (null? xss)
        ($fold-right f init xs (lambda (x) x))
        (apply r7rs-fold-right f init (cons xs xss))))

(define (reduce f ridentity xs)
    (if (null? xs)
        ridentity
        ($fold f (car xs) (cdr xs))))

(define (reduce-left f ridentity xs)
    (if (null? xs)
        ridentity
        ($fold f (car xs) (cdr xs))))

(define (reduce-right f ridentity xs)
    (if (null? xs)
        ridentity
        ($fold-right f (car xs) (cdr xs) (lambda (x) x))))

(define ($append xs ys cont)
    (if (null? xs)
        (cont ys)
        ($append (cdr xs) ys (lambda (zs) (cont (cons (car xs) zs))))))

(define (append xs ys . xss)
    (if (null? xss)
        ($append xs ys (lambda (x) x))
        (apply r7rs-append (cons xs (cons ys xss)))))
`

export const scheme3Prelude = `
;; destructive filter
(define (filter! pred lst)
  (cond ((null? lst) '())
        ((pred (car lst)) (set-cdr! lst (filter! pred (cdr lst))) lst)
        (else (filter! pred (cdr lst)))))

;; streams are already nicely implemented in the scheme stdlib,
;; we leave them as is for now
`

export const scheme4Prelude = `
(define call-with-current-continuation call/cc)
`

export const schemeFullPrelude = `
(define-syntax let 
    (syntax-rules () 
        ((_ ((name val) ...) body restbody ...) 
         ((lambda (name ...) body restbody ...) val ...))))

(define-syntax quasiquote
    (syntax-rules (unquote unquote-splicing)
        ((_ (unquote x)) x)
        ((_ ((unquote-splicing x) . rest))
            (append x (quasiquote rest)))
        ((_ (a . rest))
            (cons (quasiquote a) (quasiquote rest)))        
        ((_ x) (quote x))))
        
(define-syntax cond
  (syntax-rules (else)
    ((_) (if #f #f))

    ((_ (else val rest ...))
     (begin val rest ...))

    ((_ (test val rest ...))
     (if test
         (begin val rest ...)
         (cond))) 

    ((_ (test val rest ...) next-clauses ...)
     (if test
         (begin val rest ...)
         (cond next-clauses ...)))))

`
