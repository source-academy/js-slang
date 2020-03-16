function is_tagged_list(stmt, the_tag) {
    return is_pair(stmt) && head(stmt) === the_tag;
}
function is_return_statement(stmt) {
   return is_tagged_list(stmt, "return_statement");
}
function return_statement_expression(stmt) {
   return head(tail(stmt));
}

const my_function_declaration = parse("function f(x) { return x; }");
const my_function_definition = list_ref(my_function_declaration, 2);
const my_return_statement = list_ref(my_function_definition, 2);
display(is_return_statement(my_return_statement));
display(return_statement_expression(my_return_statement));