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
function enumerate_interval(low, high) {
    return low > high
           ? null
           : pair(low,
                  enumerate_interval(low + 1, high));
}
function even_fibs(n) {
    return accumulate(pair, 
                      null, 
                      filter(is_even, 
                             map(fib, 
                                 enumerate_interval(0, n))));
}

even_fibs(9);