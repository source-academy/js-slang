function stream_map(f, s) {
    return is_null(s)
           ? null
           : pair(f(head(s)),
                  () => stream_map(f, stream_tail(s)));
}

function stream_ref(s, n) {
    return n === 0
           ? head(s)
           : stream_ref(stream_tail(s), n - 1);
}

const my_stream = pair(4, () => pair(5, () => null));

const my_stream_2 =
    stream_map(x => { display(x); return x; }, 
               my_stream);

stream_ref(my_stream_2, 1);
stream_ref(my_stream_2, 1);
// the number 5 is shown twice
// because the same delayed
// object is forced twice
true;