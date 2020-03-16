function abs(x) {
    return x >= 0 ? x : -x;
}
function square(x) {
    return x * x;
}
function good_enough(guess) {
    return abs(square(guess) - x) < 0.001;
}