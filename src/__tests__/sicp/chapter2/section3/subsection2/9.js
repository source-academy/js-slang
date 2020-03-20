function is_product(x) {
    return is_pair(x) && head(x) === "*";
}

is_product(make_product("x", 3));