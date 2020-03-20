function is_tagged_list(stmt, the_tag) {
    return is_pair(stmt) && head(stmt) === the_tag;
}
function is_function_definition(stmt) {
   return is_tagged_list(stmt, "function_definition");
}
function function_definition_parameters(stmt) {
   return head(tail(stmt));
}
function function_definition_body(stmt) {
   return head(tail(tail(stmt)));
}

const my_function_definition = parse("x => x;");
display(is_function_definition(my_function_definition));
display(function_definition_parameters(my_function_definition));
display(function_definition_body(my_function_definition));