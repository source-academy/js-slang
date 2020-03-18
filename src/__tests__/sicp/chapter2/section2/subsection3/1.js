function square(x) {
    return x * x;
}
function is_odd(n) {
    return n % 2 === 1;
}
function sum_odd_squares(tree) {
    return is_null(tree)
           ? 0
           : ! is_pair(tree)
             ? (is_odd(tree) ? square(tree) : 0)
             : sum_odd_squares(head(tree))
               +
               sum_odd_squares(tail(tree));
}

sum_odd_squares(list(list(2, 3), list(4, 5)));