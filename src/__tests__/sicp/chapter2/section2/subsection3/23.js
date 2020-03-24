function plus(x, y) {
    return x + y;
}
function times(x, y) {
    return x * y;
}
function accumulate_n(op, init, seqs) {
    return is_null(head(seqs))
           ? null
           : pair(accumulate(op, init, map(x => head(x), seqs)),
                  accumulate_n(op, init, map(x => tail(x), seqs)));
}
function dot_product(v, w) {
    return accumulate(plus, 0, 
                      accumulate_n(times, 1, list(v, w)));
}

dot_product(list(1, 2), list(3, 4));