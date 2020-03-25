function append(list1, list2) {
    return is_null(list1)
           ? list2
           : pair(head(list1), append(tail(list1), list2));
}
const squares = list(1, 4, 9, 16, 25);
const squares = list(1, 3, 5, 7);
append(odds, squares);

// returns: [1, [3, [5, [7, [1, [4, [9, [16, [25, null]]]]]]]]]