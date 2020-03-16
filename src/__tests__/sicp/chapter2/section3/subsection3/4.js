function is_element_of_set(x,set) {
    return ! is_null(set) && 
           ( x === head(set)) 
             ? true
             : x < head(set)
               ? false
               : is_element_of_set(x, tail(set));
}

is_element_of_set(15, list(10, 15, 20));