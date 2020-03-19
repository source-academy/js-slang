function accumulate(op, initial, sequence) {
    return is_null(sequence)
           ? initial
           : op(head(sequence), 
                accumulate(op, initial, tail(sequence)));
}
function times(x, y) {
    return x * y;
}
accumulate(times, 1, list(1, 2, 3, 4, 5));