function multiplicand(s) {
    return head(tail(tail(s)));
}

multiplicand(make_product("x", 3));