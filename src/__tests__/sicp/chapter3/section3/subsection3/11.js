function make_table() {
    const local_table = list("*table*");
    function lookup(key_1, key_2) {
        const subtable = assoc(key_1, tail(local_table));
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
    function insert(key_1, key_2, value) {
        const subtable = assoc(key_1, tail(local_table));
        if (subtable === undefined) {
            set_tail(local_table,
                     pair(list(key_1, pair(key_2, value)),
                          tail(local_table)));
        } else {
            const record = assoc(key_2, tail(subtable));
            if (record === undefined) {
      	        set_tail(subtable,
	                       pair(pair(key_2, value),
                              tail(subtable)));
	    } else {
                set_tail(record, value);
            }
        }
    }
    function dispatch(m) {
        return m === "lookup"
               ? lookup
               : m === "insert"
                 ? insert
                 : "undefined operation -- table";
    }
    return dispatch;
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
function memoize(f) {
    const table = make_table();
    return x => {
        const previously_computed_result 
            = lookup(x, table);
        if (previously_computed_result === undefined) {
            const result = f(x);
            insert(x, result, table);
            return result;
        } else {
            return previously_computed_result;
        }
    };
}