const x = list(list(1, 2), list(3, 4));
// fringe to be written by student
fringe(list(x, x));
// [1, [2, [3, [4, [1, [2, [3, [4, null]]]]]]]]