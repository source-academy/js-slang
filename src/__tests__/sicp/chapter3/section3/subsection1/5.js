function last_pair(x) {
    return is_null(tail(x)))
           ? x
           : last_pair(tail(x));
}