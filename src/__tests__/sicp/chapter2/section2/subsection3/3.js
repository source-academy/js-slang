function square(x) {
    return x * x;
}
function map(fun, items) {
    return is_null(items)
           ? null
           : pair(fun(head(items)), 
                  map(fun, tail(items)));
}
map(square, list(1, 2, 3, 4, 5));