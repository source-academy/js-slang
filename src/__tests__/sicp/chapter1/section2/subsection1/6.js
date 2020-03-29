function A(x,y) {
    return y === 0
           ? 0
           : x === 0
             ? 2 * y
             : y === 1
               ? 2
               : A(x - 1, A(x, y - 1));
}

A(1, 10);