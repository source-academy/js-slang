function is_even(n) {
    return n % 2 === 0;
}
function expmod(base, exp, m) {
    const to_half = expmod(base, exp / 2, m);
    return exp === 0
           ? 1
           : is_even(exp)
             ? to_half * to_half
               % m
             : base
               * expmod(base, exp - 1, m) 
               % m;
}

expmod(4, 3, 5);