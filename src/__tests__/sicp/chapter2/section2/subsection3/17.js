function map(f, sequence) {
    return accumulate((x, y) => ?? , 
                      null, sequence);
}

function append(seq1, seq2) {
    return accumulate(pair, ??, ??);
}

function length(sequence) {
    return accumulate(??, 0, sequence);
}

map_(math_sqrt, list(1, 2, 3, 4));
// append_(list(1, 2, 3), list(4, 5, 6));
// length_(list(1, 2, 3, 4));