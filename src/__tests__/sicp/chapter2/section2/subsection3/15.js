function square(x) {
    return x * x;
}
function is_odd(n) {
    return n % 2 === 1;
}
function times(x, y) {
    return x * y;
}
function product_of_squares_of_odd_elements(sequence) {
    return accumulate(times, 
                      1, 
                      map(square, 
                          filter(is_odd, sequence)));
}

product_of_squares_of_odd_elements(list(1, 2, 3, 4, 5));