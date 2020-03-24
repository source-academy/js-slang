function member(item, x) {
    return is_null(x)
        ? false
        : item === head(x)
          ? x
          : member(item, tail(x));
}
member("apple", 
     list("x", list("apple","sauce"), "y", "apple", "pear"));