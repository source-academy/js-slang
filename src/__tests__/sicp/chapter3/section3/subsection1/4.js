function last_pair(x) {
    return is_null(tail(x)))
           ? x
           : last_pair(tail(x));
}
function append_mutator(x, y) {
    set_tail(last_pair(x), y);
}