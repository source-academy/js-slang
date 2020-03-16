function map(fun, items) {
    return is_null(items)
           ? null
           : pair(fun(head(items)), 
                  map(fun, tail(items)));
}

map(abs, list(-10, 2.5, -11.6, 17));