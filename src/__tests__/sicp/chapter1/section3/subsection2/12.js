function is_even(n) {
    return n % 2 === 0;
}
function expmod(base, exp, m) {
    return exp === 0
           ? 1
           : is_even(exp)
             ? expmod(base, exp / 2, m) 
               * expmod(base, exp / 2, m)
               % m
             : base
               * expmod(base, exp - 1, m) 
               % m;
}

expmod(4, 3, 5);