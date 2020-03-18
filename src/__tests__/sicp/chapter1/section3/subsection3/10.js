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
function average(x,y) {
    return (x + y) / 2;
}
function sqrt(x) {
    return fixed_point(
               y => average(y, x / y),
               1.0);
}

sqrt(5);