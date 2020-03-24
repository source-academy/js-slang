function is_element_of_set(x, set) {
   return ! is_null(set) && 
          ( is_equal(x, head(set)) || 
            is_element_of_set(x, tail(set)) );
}
function is_equal(a, b) {
    return (is_pair(a) && is_pair(b) &&
            is_equal(head(a), head(b)) && is_equal(tail(a), tail(b)))
           || 
           a === b;
}
function adjoin_set(x, set) {
    return is_element_of_set(x, set)
           ? set
           : pair(x, set);
}

adjoin_set(10, adjoin_set(15, adjoin_set(20, null)));