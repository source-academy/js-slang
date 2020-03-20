function abs(x) {
    return x >= 0 ? x : -x;
}
function close_enough(x,y) {
    return abs(x - y) < 0.001;
}

close_enough(7.7654, 7.7666);