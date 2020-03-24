function sum_integers(a, b) {
    return sum(identity, a, inc, b);
}
function sum(term, a, next, b) {
    return a > b
           ? 0
           : term(a) + sum(term, next(a), next, b);
}
function inc(n) {
    return n + 1;
}
function identity(x) {
    return x;
}
sum_integers(1, 10);