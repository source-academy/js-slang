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
function sum_primes(a, b) {
    function iter(count, accum) {
        if (count > b) {
            return accum;
        } else {
            if (is_prime(count)) {
                return iter(count + 1, count + accum);
            } else {
                return iter(count + 1, accum);
            }
        }
    }
    return iter(a, 0);
}

sum_primes(7, 182);