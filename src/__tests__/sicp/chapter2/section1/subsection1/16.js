function numer(x) {
    return head(x);
}
function denom(x) {
    return tail(x);
}
function add_rat(x, y) {
    return make_rat(numer(x) * denom(y) + numer(y) * denom(x),
                    denom(x) * denom(y));
}
function sub_rat(x, y) {
    return make_rat(numer(x) * denom(y) - numer(y) * denom(x),
                    denom(x) * denom(y));
}
function mul_rat(x, y) {
    return make_rat(numer(x) * numer(y),
                    denom(x) * denom(y));
}
function div_rat(x, y) {
    return make_rat(numer(x) * denom(y),
                    denom(x) * numer(y));
}
function equal_rat(x, y) {
    return numer(x) * denom(y) === numer(y) * denom(x);
}
function make_rat(n, d) {
    const g = gcd(n, d);
    return pair(n / g, d / g);
}
function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
}
const one_third = make_rat(1, 3);
print_rat(add_rat(one_third, one_third));