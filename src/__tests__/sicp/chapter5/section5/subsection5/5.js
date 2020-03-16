function factorial_alt(n) {
    return  n === 1  
        ? 1
        : factorial_alt(n - 1) * n;
}