function square(x) {
    return x * x;
}
function f(x,y) {
    return ( (a,b) => x * square(a) + 
                      y * b + 
                      a * b
           )(1 + x * y, 1 - y);
}

f(3, 4);