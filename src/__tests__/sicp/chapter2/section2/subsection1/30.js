function scale_list(items, factor) {
    return map(x => x * factor, items);
}

scale_list(list(1, 2, 3, 4, 5), 10);