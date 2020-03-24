function is_sum(x) {
    return is_pair(x) && head(x) === "+";
}

is_sum(make_sum("x", 3));