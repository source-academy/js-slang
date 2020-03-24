function filter(predicate, sequence) {
    return is_null(sequence)
           ? null
           : predicate(head(sequence))
             ? pair(head(sequence), 
                    filter(predicate, tail(sequence)))
             : filter(predicate, tail(sequence));
}
function is_odd(n) {
    return n % 2 === 1;
}
filter(is_odd, list(1, 2, 3, 4, 5));