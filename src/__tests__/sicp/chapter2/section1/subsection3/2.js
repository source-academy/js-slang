function pair(x, y) {
    return m => m(x, y);
}
function head(z) {
    return z((p, q) => p);
}

const x = pair(1,2);
head(x);