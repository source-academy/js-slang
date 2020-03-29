function apply_primitive_function(fun, argument_list) {
    return apply_in_underlying_javascript(
                primitive_implementation(fun),
                argument_list);     
}

apply_primitive_function(my_primitive_plus, list(1, 2));