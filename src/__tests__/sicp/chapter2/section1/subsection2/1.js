function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
}
function make_rat(n, d) {
    return pair(n, d);
}
function numer(x) {
    const g = gcd(head(x), tail(x));
    return head(x) / g;
}
function denom(x) {
    const g = gcd(head(x), tail(x));
    return tail(x) / g;
}

function print_rat(x) {
    display(numer(x));
    display("-");
    display(denom(x));
}

const one_half = make_rat(1, 2);

print_rat(one_half);