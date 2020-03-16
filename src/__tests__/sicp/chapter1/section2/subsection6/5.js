function square(x) {
    return x * x;
}
function expmod(base, exp, m) {
    return exp === 0
           ? 1
           : is_even(exp)
             ? square(expmod(base, exp / 2, m)) % m
             : (base * expmod(base, exp - 1, m)) % m;
}
function is_even(n) {
    return n % 2 === 0;
}
function random(n) {
    return math_floor(math_random() * n);
}
function fermat_test(n) {
    function try_it(a) {
        return expmod(a, n, n) === a;
    }
    return try_it(1 + random(n - 1));
}
function fast_is_prime(n, times) {
    return times === 0
           ? true
           : fermat_test(n)
             ? fast_is_prime(n, times - 1)
             : false;
}

fast_is_prime(91, 3);