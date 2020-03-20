function stream_tail(stream) {
    return tail(stream)();
}
function stream_filter(pred, s) {
    return is_null(s)
           ? null
           : pred(head(s))
             ? pair(head(s),
                    () => stream_filter(pred, 
                                        stream_tail(s)))
             : stream_filter(pred,
                             stream_tail(s));
}

const my_stream = pair(5, () => pair(6, () => pair(7, () => null)));
const my_filtered_stream =
    stream_filter(x => x % 2 === 0, my_stream);
display_stream(my_filtered_stream);