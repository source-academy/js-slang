function member(item, x) {
    return is_null(x)
        ? false
        : item === head(x)
          ? x
          : member(item, tail(x));
}

member("apple", list("pear", "banana", "prune"));