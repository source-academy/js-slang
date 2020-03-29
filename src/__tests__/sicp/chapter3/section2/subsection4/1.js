function abs(x) {
    return x >= 0 ? x : -x;
}
function square(x) {
    return x * x;
}
function average(x,y) {
    return (x + y) / 2;
}
function sqrt(x) {
    function good_enough(guess) {
        return abs(square(guess) - x) < 0.001;
    }
    function improve(guess) {
        return average(guess,x/guess);
    }
    function sqrt_iter(guess){
        return good_enough(guess)
            ? guess
            : sqrt_iter(improve(guess));
    }
    return sqrt_iter(1.0);
}

sqrt(5);