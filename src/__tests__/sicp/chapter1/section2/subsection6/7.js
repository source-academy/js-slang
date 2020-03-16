function fast_expt(b, n) {
    return n === 0
           ? 1
           : is_even(n)
             ? square(fast_expt(b, n / 2))
             : b * fast_expt(b, n - 1);
}
function expmod(base, exp, m) {
    return fast_expt(base, exp) % m;
}

expmod(4, 3, 5);