const dx = 0.00001;
function deriv(g) {
    return x => (g(x + dx) - g(x)) / dx;
}
function cube(x) { return x * x * x; }

deriv(cube)(5);