let a = 1;
function f(x) {      
    let b = a + x;
    let a = 5;
    return a + b;
}
f(10);