function square(x) {
    return x * x;
}
((x, y, z) => x + y + square(z))(1, 2, 3);