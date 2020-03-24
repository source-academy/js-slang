function sqrt(x) {
    return sqrt_iter(1, x);
}
function sqrt_iter(guess, x) {
    return good_enough(guess, x)
           ? guess
           : sqrt_iter(improve(guess, x), x);
}
function good_enough(guess, x) {
    return abs(square(guess) - x) < 0.001;
}
function abs(x) {
    return x >= 0 ? x : -x;
}
function square(x) {
    return x * x;
}
function improve(guess, x) {
    return average(guess, x / guess);
}
function average(x,y) {
    return (x + y) / 2;
}
sqrt(9);