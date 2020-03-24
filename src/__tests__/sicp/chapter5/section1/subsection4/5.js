function expt(b, n) {
    return n === 0
        ? 1
        : b * expt(b, n - 1);
}