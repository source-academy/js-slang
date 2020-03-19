function is_prime(n) {
    return n === smallest_divisor(n);
}
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
function timed_prime_test(n) {
    display(n);
    return start_prime_test(n, runtime());
}
function start_prime_test(n, start_time) {
    return is_prime(n)
           ? report_prime(runtime() - start_time)
           : true;
}
function report_prime(elapsed_time) {
    display(" *** ");
    display(elapsed_time);
}

timed_prime_test(43);