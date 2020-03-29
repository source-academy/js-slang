function is_tagged_list(stmt, the_tag) {
    return is_pair(stmt) && head(stmt) === the_tag;
}
function is_constant_declaration(stmt) {
   return is_tagged_list(stmt, "constant_declaration");
}
function constant_declaration_name(stmt) {
   return head(tail(head(tail(stmt))));
}
function constant_declaration_value(stmt) {
   return head(tail(tail(stmt)));
}
function is_variable_declaration(stmt) {
   return is_tagged_list(stmt, "variable_declaration");
}
function variable_declaration_name(stmt) {
   return head(tail(head(tail(stmt))));
}
function variable_declaration_value(stmt) {
   return head(tail(tail(stmt)));
}

const my_declaration_statement = parse("let x = 1;");
display(is_variable_declaration(my_declaration_statement));
display(variable_declaration_name(my_declaration_statement));
display(variable_declaration_value(my_declaration_statement));