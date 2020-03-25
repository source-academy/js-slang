function is_prime(n) {
    return n === smallest_divisor(n);
}
function smallest_divisor(n) {
    return find_divisor(n, 2);
}
function find_divisor(n, test_divisor) {
     return square(test_divisor) > n
            ? n
            : divides(test_divisor, n)
              ? test_divisor
              : find_divisor(n, test_divisor + 1);
}
function divides(a, b) {
    return b % a === 0;
}
function square(x) {
    return x * x;
}
function stream_filter(pred, s) {
    return is_null(s)
           ? null
           : pred(head(s))
             ? pair(head(s),
                    () => stream_filter(pred, 
                                        stream_tail(s)))
             : stream_filter(pred,
                             stream_tail(s));
}
function stream_tail(stream) {
    return tail(stream)();
}
function integers_starting_from(n) {
    return pair(n,
                () => integers_starting_from(n + 1)
               );
}
const primes = pair(2,
                    () => stream_filter(
                              is_prime, 
			      integers_starting_from(3))
		   );