function stream_tail(stream) {
    return tail(stream)();
}
function merge(s1, s2) {
    if (is_null(s1)) {
        return s2;
    } else if (is_null(s2)) {
        return s1;
    } else {
        const s1head = head(s1);
        const s2head = head(s2);
        if (s1head < s2head) {
            return pair(s1head,
                        () => merge(stream_tail(s1), s2)
                       );
        } else if (s1head > s2head) {
            return pair(s2head,
                        () => merge(s1, stream_tail(s2))
                       );
        } else {
            return merge(stream_tail(s1), stream_tail(s2));
        }
    }
}