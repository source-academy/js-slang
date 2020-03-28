function sum_integers(a, b) {
    return a > b
           ? 0
           : a + sum_integers(a + 1, b);
}

sum_integers(1, 10);