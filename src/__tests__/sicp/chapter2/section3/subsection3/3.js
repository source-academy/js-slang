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
function intersection_set(set1, set2) {
    return is_null(set1) || is_null(set2)
           ? null
           : is_element_of_set(head(set1), set2)
             ? pair(head(set1),
                    intersection_set(tail(set1), set2))
             : intersection_set(tail(set1), set2);
}

intersection_set(
   adjoin_set(10, adjoin_set(20, adjoin_set(30, null))),
   adjoin_set(10, adjoin_set(15, adjoin_set(20, null))));