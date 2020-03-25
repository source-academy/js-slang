function smallest_divisor(n) {
    return find_divisor(n, 2);
}
function find_divisor(n, test_divisor) {
     return square(test_divisor) > n
            ? n
            : divides(test_divisor, n)
              ? test_divisor
              : find_divisor(n, test_divisor + 1);
}
function divides(a, b) {
    return b % a === 0;
}
function square(x) {
    return x * x;
}
function is_prime(n) {
    return n === smallest_divisor(n);
}

is_prime(42);