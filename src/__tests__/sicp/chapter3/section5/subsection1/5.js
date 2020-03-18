function stream_tail(stream) {
    return tail(stream)();
}
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

const my_stream = pair(4, () => pair(5, () => null));
display(stream_ref(my_stream, 1));
const my_stream_2 = stream_map(x => x + 1, my_stream);
stream_for_each(display, my_stream_2);