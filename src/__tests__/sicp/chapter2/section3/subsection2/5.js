function make_sum(a1, a2) {
    return list("+", a1, a2);
}
function make_product(m1, m2) {
    return list("*", m1, m2);
}

make_sum(make_product("x", 3), make_product("y", "z"));