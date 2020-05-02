function append(x, y) {
    return is_null(x)
           ? y
           : pair(head(x), append(tail(x), y));
}