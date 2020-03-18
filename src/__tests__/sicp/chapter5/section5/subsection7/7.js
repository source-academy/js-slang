compile_and_go(
    parse(
        "function factorial(n) {
             return n === 1 
                 ? 1
                 : n * factorial(n - 1);
         }"));

(total-pushes = 0 maximum-depth = 0)
;;; EC-Eval value:
ok

;;; EC-Eval input:
(factorial 5)
(total-pushes = 31 maximum-depth = 14)
;;; EC-Eval value:
120