function setup_environment() {
    const primitive_function_names =
        map(f => head(f), primitive_functions);
    const primitive_function_values =
        map(f => make_primitive_function(head(tail(f))),
            primitive_functions);
    const primitive_constant_names =
        map(f => head(f), primitive_constants);
    const primitive_constant_values =
        map(f => head(tail(f)),
            primitive_constants);
    return extend_environment(
               append(primitive_function_names, 
                      primitive_constant_names),
               append(primitive_function_values, 
                      primitive_constant_values),
               the_empty_environment);
}

const the_global_environment = setup_environment();
	
the_global_environment;