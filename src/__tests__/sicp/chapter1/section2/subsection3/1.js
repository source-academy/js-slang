function abs(x) {
    return x >= 0 ? x : -x;
}
function cube(x) {
    return x * x * x;
}
function p(x) {
    return 3 * x - 4 * cube(x);
}
function sine(angle) {
    return !(abs(angle) > 0.1)
           ? angle
           : p(sine(angle / 3.0));
}

sine(math_PI / 2);