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
function lookup(key_1, key_2, table) {
    const subtable = assoc(key_1, tail(table));
    if (subtable === undefined) {
        return undefined;
    } else {
        const record = assoc(key_2, tail(subtable));
        if (record === undefined) {
            return undefined;
        } else {
            return tail(record);
        }
    }
}