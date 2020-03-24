function remainder(n, d) {
    return n < d
        ? n
        : remainder(n - d, d);
}