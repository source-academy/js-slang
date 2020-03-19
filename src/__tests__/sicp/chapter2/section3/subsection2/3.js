function is_variable(x) {
    return is_string(x);
}
function is_same_variable(v1, v2) {
    return is_variable(v1) && 
           is_variable(v2) && v1 === v2;
}

is_same_variable("xyz", "xyz");