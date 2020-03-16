function reverse(sequence) {
    return fold_right((x, y) => ??, null, sequence);
}

reverse(list(1, 4, 9, 16, 25));
// result: [25, [16, [9, [4, [1, null]]]]]