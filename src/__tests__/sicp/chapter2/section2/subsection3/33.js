function flatmap(f, seq) {
    return accumulate(append, null, map(f, seq));
}

flatmap(x => list(x, x), list(1, 2, 3, 4));