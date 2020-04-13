function is_prime(n) {
    return n === smallest_divisor(n);
}
function stream_enumerate_interval(low, high) {
    return low > high
           ? null
           : pair(low,
                  () => stream_enumerate_interval(low + 1, 
                                                  high)); 
}
pair(10007,
     () => stream_filter(is_prime,
               pair(10008,
                    () => stream_enumerate_interval(10009, 
                                                    1000000))
	      )
    );