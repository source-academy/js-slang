function scale_list(items, factor) {
    return is_null(items)
           ? null
           : pair(head(items) * factor, 
                  scale_list(tail(items), factor));
}

scale_list(list(1, 2, 3, 4, 5), 10);