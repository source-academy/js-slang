// compose to be written by student; see EXERCISE 1.42
function square(x) {
    return x * x;
}
function inc(n) {
    return n + 1;
}
compose(square, inc)(6);