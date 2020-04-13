compile_and_go(
    parse(
        "function factorial(n) {
             return n === 1 
                 ? 1
                 : n * factorial(n - 1);
         }"));

;;; EC-Eval value:
ok

;;; EC-Eval input:
(factorial 5)
;;; EC-Eval value:
120