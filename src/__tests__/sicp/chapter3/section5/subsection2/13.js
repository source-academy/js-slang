function square(x) {
    return x * x;
}
function is_divisible(x, y) {
    return x % y === 0;
}

const no_sevens =
    stream_filter(x => ! is_divisible(x, 7),
                  integers);
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
const integers = pair(1, () => add_streams(ones, integers));
function add_streams(s1, s2) {
    return stream_combine((x1, x2) => x1 + x2, s1, s2);
}
function stream_ref(s, n) {
    return n === 0
           ? head(s)
           : stream_ref(stream_tail(s), n - 1);
}
function stream_map(f, s) {
    return is_null(s)
           ? null
           : pair(f(head(s)),
                  () => stream_map(f, stream_tail(s)));
}
function stream_for_each(fun, s) {
    if (is_null(s)) {
        return true;
    } else {
        fun(head(s));
        return stream_for_each(fun, stream_tail(s));
    }
}
function stream_combine(f, s1, s2) {
    return is_null(s1) && is_null(s2)
        ? null
        : is_null(s1) || is_null(s2)
        ? error(null, "unexpected null in stream_combine")
        : pair(f(head(s1),head(s2)), 
               () => stream_combine(f, stream_tail(s1),
                                       stream_tail(s2)));
}
const ones = pair(1, () => ones);
const primes = pair(2,
                    () => stream_filter(
                              is_prime, 
			      integers_starting_from(3))
		   );
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
function integers_starting_from(n) {
    return pair(n,
                () => integers_starting_from(n + 1)
               );
}
function is_prime(n) {
    function iter(ps) {
        return square(head(ps)) > n
               ? true
               : is_divisible(n, head(ps))
                 ? false
                 : iter(stream_tail(ps));
    }
    return iter(primes);
}