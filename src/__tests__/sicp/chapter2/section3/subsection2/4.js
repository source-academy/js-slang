function make_sum(a1, a2) {
    return list("+", a1, a2);
}

make_sum(make_product("x", 3), make_product("y", "z"));