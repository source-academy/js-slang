function enumerate_interval(low, high) {
    return low > high
           ? null
           : pair(low,
                  enumerate_interval(low + 1, high));
}
const n = 6;
accumulate(append, 
           null, 
           map(i => map(j => list(i, j),
                        enumerate_interval(1, i-1)),
               enumerate_interval(1, n)));