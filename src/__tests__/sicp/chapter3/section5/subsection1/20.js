function stream_enumerate_interval(low, high) {
    return low > high
           ? null
           : pair(low,
                  () => stream_enumerate_interval(low + 1, 
                                                  high)); 
}
function is_even(n) {
    return n % 2 === 0;
}
function display_stream(s) {
    return stream_for_each(display, s);
}
let sum = 0;

function accum(x) {
    sum = x + sum;
    return sum;
}

const seq = stream_map(
                accum, 
                stream_enumerate_interval(1, 20));
const y = stream_filter(is_even, seq);

const z = stream_filter(x => x % 5 === 0, seq);

stream_ref(y, 7);

display_stream(z);