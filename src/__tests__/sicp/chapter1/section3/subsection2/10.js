function square(x) {
    return x * x;
}
function f(x, y) {
    const a = 1 + x * y;
    const b = 1 - y;
    return x * square(a) + 
           y * b + 
           a * b;
}

f(3, 4);