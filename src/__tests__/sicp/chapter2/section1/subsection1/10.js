function print_rat(x) {
    display(numer(x));
    display("-");
    display(denom(x));
}
function make_rat(n, d) {
    return pair(n, d);
}
function numer(x) {
    return head(x);
}
function denom(x) {
    return tail(x);
}
const one_third = make_rat(1, 3);

print_rat(one_third);