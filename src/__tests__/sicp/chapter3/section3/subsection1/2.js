// The textbook proposes a primitive function get_new_pair.
// Since JavaScript does not provide such a function, let's
// define it as follows, for the sake of the example.

function get_new_pair() {
    return pair(undefined, undefined);
}
function pair(x, y) {
    const fresh = get_new_pair();
    set_head(fresh, x);
    set_tail(fresh, y);
    return fresh;
}

pair(pair(1, 2), 4);