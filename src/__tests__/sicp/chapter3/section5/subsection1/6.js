function stream_ref(s, n) {
    return n === 0
           ? head(s)
           : stream_ref(stream_tail(s), n - 1);
}
function stream_map(f, s) {
    return is_null(s)
           ? null
           : pair(f(head(s)),
                  () => stream_map(f, stream_tail(s)));
}
function stream_for_each(fun, s) {
    if (is_null(s)) {
        return true;
    } else {
        fun(head(s));
        return stream_for_each(fun, stream_tail(s));
    }
}
function stream_tail(stream) {
    return tail(stream)();
}
function display_stream(s) {
    return stream_for_each(display, s);
}

const my_stream = pair(4, () => pair(5, () => null));
display_stream(my_stream);