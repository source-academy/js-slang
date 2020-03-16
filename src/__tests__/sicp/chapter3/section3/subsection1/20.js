function count_pairs(x) {
    return !is_pair(x)
           ? 0
           : count_pairs(head(x)) + 
             count_pairs(tail(x)) + 1;
}