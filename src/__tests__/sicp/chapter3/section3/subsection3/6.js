function assoc(key, records) {
    return is_null(records)
           ? undefined
           : is_equal(key, head(head(records)))
             ? head(records)
             : assoc(key, tail(records));
}
function is_equal(a, b) {
    return (is_pair(a) && is_pair(b) &&
            is_equal(head(a), head(b)) && is_equal(tail(a), tail(b)))
           || 
           a === b;
}
function insert(key_1, key_2, value, table) {
    const subtable = assoc(key_1, tail(table));
    if (subtable === undefined) {
        set_tail(table,
                 pair(list(key_1, pair(key_2, value)),
                      tail(table)));
    } else {
        const record = assoc(key_2, tail(table));
        if (record === undefined) {
            set_tail(subtable,
                     pair(pair(key_2, value),
                          tail(subtable)));
        } else {
            set_tail(record, value);
        }
    }
}