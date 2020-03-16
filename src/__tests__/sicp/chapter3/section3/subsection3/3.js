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
function insert(key, value, table) {
    const record = assoc(key, tail(table));
    return record === undefined
           ? set_tail(table, pair(pair(key, value),
                                  tail(table)))
           : set_tail(record, value);
}