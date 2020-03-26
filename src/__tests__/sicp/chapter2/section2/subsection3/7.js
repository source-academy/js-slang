function accumulate(op, initial, sequence) {
    return is_null(sequence)
           ? initial
           : op(head(sequence), 
                accumulate(op, initial, tail(sequence)));
}
function plus(x, y) {
    return x + y;
}
accumulate(plus, 0, list(1, 2, 3, 4, 5));