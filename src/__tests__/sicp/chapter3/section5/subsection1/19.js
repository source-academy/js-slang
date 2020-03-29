function stream_map_optimized(f, s) {
    return is_null(s)
           ? null
           : pair(f(head(s)),
                  memo( () => stream_map_optimized(
                                 f, stream_tail(s)) ));
}
function stream_enumerate_interval(low, high) {
    return low > high
           ? null
           : pair(low,
                  () => stream_enumerate_interval(low + 1, 
                                                  high)); 
}
function show(x) {
    display(x);
    return x;
}
let x = stream_map_optimized(
            show, 
            stream_enumerate_interval(0, 10));
stream_ref(x, 5);
stream_ref(x, 7);