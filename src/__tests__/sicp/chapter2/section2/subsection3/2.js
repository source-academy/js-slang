function is_even(n) {
    return n % 2 === 0;
}
function fib(n) {
    return n === 0
           ? 0
           : n === 1
             ? 1
             : fib(n - 1) + fib(n - 2);
}
function even_fibs(n) {
    function next(k) {
        if (k > n) {
            return null;
        } else {
            const f = fib(k);
            return is_even(f)
                   ? pair(f, next(k + 1))
                   : next(k + 1);
        }
    }
    return next(0);
}

even_fibs(9);