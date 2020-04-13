function average(x,y) {
    return (x + y) / 2;
}
function improve(guess, x) {
    return average(guess, x / guess);
}

improve(3, 25);