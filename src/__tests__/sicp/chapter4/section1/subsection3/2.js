function is_tagged_list(stmt, the_tag) {
    return is_pair(stmt) && head(stmt) === the_tag;
}
function make_compound_function(parameters, body, env) {
    return list("compound_function",
                parameters, body, env);
}
function is_compound_function(f) {
    return is_tagged_list(f, "compound_function");
}
function function_parameters(f) {
    return list_ref(f, 1);
}
function function_body(f) {
    return list_ref(f, 2);
}
function function_environment(f) {
    return list_ref(f, 3);
}

const my_function = 
    make_compound_function(
        list("x", "y"),
        list("return_statement", parse("x + y;")),
        the_empty_environment);
display(is_compound_function(my_function));
display(function_parameters(my_function));
display(function_body(my_function));
display(function_environment(my_function));