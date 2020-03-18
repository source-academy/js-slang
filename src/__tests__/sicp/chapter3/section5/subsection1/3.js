function is_prime(n) {
    return n === smallest_divisor(n);
}
function enumerate_interval(low, high) {
    return low > high
           ? null
           : pair(low,
                  enumerate_interval(low + 1, high));
}
head(tail(filter(is_prime,
                 enumerate_interval(10000, 1000000))));