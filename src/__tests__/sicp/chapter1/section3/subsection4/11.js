function fixed_point_of_transform(g, transform, guess) {
    return fixed_point(transform(g), guess);
}
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
function average_damp(f) {
    return x => average(x, f(x));
}
function average(x,y) {
    return (x + y) / 2;
}
function sqrt(x) {
    return fixed_point_of_transform(
               y => x / y,
               average_damp,
               1.0);
}

sqrt(6);