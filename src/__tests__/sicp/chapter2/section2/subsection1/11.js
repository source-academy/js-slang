function length(items) {
    function length_iter(a, count) {
        return is_null(a)
               ? count
               : length_iter(tail(a), count + 1);
    }
    return length_iter(items, 0);
}

const odds = list(1, 3, 5, 7);
length(odds);
// returns: 4