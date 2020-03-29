function is_even(n) {
    return n % 2 === 0;
}
function expmod(base, exp, m) {
    if (exp === 0) {
        return 1;
    } else {
        if (is_even(exp)) {
            const to_half = expmod(base, exp / 2, m);    
            return to_half * to_half % m;
        } else {
            return base * expmod(base, exp - 1, m) % m;
        }
    }	    
}

expmod(4, 3, 5);