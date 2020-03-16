function augend(s) {
    return head(tail(tail(s)));
}

augend(make_sum("x", 3));