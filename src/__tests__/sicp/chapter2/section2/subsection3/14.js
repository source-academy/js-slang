function square(x) {
    return x * x;
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
function list_fib_squares(n) {
    return accumulate(pair, 
                      null, 
                      map(square, 
                          map(fib, 
                              enumerate_interval(0, n))));
}

list_fib_squares(10);