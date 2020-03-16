function cube(x) {
    return x * x * x;
}
function sum_cubes(a, b) {
    return a > b
           ? 0
           : cube(a) + sum_cubes(a + 1, b);
}

sum_cubes(3, 7);