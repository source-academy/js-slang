const tolerance = 0.00001;
function fixed_point(f, first_guess) {
    function close_enough(x, y) {
        return abs(x - y) < tolerance;
    }
    function try_with(guess) {
        const next = f(guess);
        return close_enough(guess, next)
               ? next
               : try_with(next);
    }
    return try_with(first_guess);
}
function abs(x) {
    return x >= 0 ? x : -x;
}
function sqrt(x) {
    return fixed_point(y => x / y, 1.0);
}
// warning: does not converge!

sqrt(5);