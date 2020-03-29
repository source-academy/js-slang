function is_tagged_list(stmt, the_tag) {
    return is_pair(stmt) && head(stmt) === the_tag;
}
function is_sequence(stmt) {
   return is_tagged_list(stmt, "sequence");
}
function make_sequence(stmts) {
   return list("sequence", stmts);
}
function sequence_statements(stmt) {   
   return head(tail(stmt));
}
function is_empty_sequence(stmts) {
   return is_null(stmts);
}
function is_last_statement(stmts) {
   return is_null(tail(stmts));
}
function first_statement(stmts) {
   return head(stmts);
}
function rest_statements(stmts) {
   return tail(stmts);
}

const my_sequence = parse("1; true; 45;");
display(is_sequence(my_sequence));
const my_actions = sequence_statements(my_sequence);
display(is_empty_sequence(my_actions));
display(is_last_statement(my_actions));
display(first_statement(my_actions));
display(rest_statements(my_actions));