function conditional(predicate, then_clause, else_clause) {		    
    return predicate ? then_clause : else_clause;
}
function good_enough(guess, x) {
    return abs(square(guess) - x) < 0.001;
}
function improve(guess, x) {
    return average(guess, x / guess);
}
function sqrt_iter(guess, x) {
    return conditional(good_enough(guess, x),
                       guess,
                       sqrt_iter(improve(guess, x),
                                 x));
}

sqrt_iter(3,25);