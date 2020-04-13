function sum(term, a, next, b) {
    return a > b
           ? 0
           : term(a) + sum(term, next(a), next, b);
}
function pi_sum(a,b) {
    return sum(x => 1.0 / (x * (x + 2)),
               a,
               x => x + 4,
               b);
}

8 * pi_sum(1, 1000);