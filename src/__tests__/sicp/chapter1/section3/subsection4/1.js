function average(x,y) {
    return (x + y) / 2;
}
function average_damp(f) {
    return x => average(x, f(x));
}

average_damp(square)(10);