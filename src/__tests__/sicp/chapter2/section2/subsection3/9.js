function accumulate(op, initial, sequence) {
    return is_null(sequence)
           ? initial
           : op(head(sequence), 
                accumulate(op, initial, tail(sequence)));
}
accumulate(pair, null, list(1, 2, 3, 4, 5));