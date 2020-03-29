function make_pair_sum(pair) {
    return list(head(pair), head(tail(pair)), 
                head(pair) + head(tail(pair)));
}
function is_prime_sum(pair) {
    return is_prime(head(pair) + head(tail(pair)));
}
function flatmap(f, seq) {
    return accumulate(append, null, map(f, seq));
}
function enumerate_interval(low, high) {
    return low > high
           ? null
           : pair(low,
                  enumerate_interval(low + 1, high));
}
function prime_sum_pairs(n) {
    return map(make_pair_sum, 
             filter(is_prime_sum, 
               flatmap(i => map(j => list(i, j), 
                                enumerate_interval(1, i - 1)),
                       enumerate_interval(1, n))));
}

prime_sum_pairs(6);