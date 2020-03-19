function square(x) {
    return x * x;
}
function f(x, y) {
    function f_helper(a, b) {
        return x * square(a) + 
               y * b + 
               a * b;
    }
    return f_helper(1 + x * y,
                    1 - y);
}

f(3, 4);