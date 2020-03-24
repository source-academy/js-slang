function square(x) {
    return x * x;
}
function plus(x, y) {
    return x + y;
}
function is_odd(n) {
    return n % 2 === 1;
}
function enumerate_tree(tree) {
    return is_null(tree)
           ? null
           : ! is_pair(tree)
             ? list(tree)
             : append(enumerate_tree(head(tree)),
                      enumerate_tree(tail(tree)));
}
function sum_odd_squares(tree) {
    return accumulate(plus, 
                      0, 
                      map(square, 
                          filter(is_odd, 
                                 enumerate_tree(tree))));
}

sum_odd_squares(list(list(2, 3), list(4, 5)));