function sqrt(x) {
    function good_enough(guess, x) {
        return abs(square(guess) - x) < 0.001;
    }
    function improve(guess, x) {
        return average(guess, x / guess);
    }
    function sqrt_iter(guess, x) {
        return good_enough(guess, x)
            ? guess
            : sqrt_iter(improve(guess, x), x);
    }
    return  sqrt_iter(1.0);
}