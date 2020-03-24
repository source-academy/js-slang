function is_tagged_list(stmt, the_tag) {
    return is_pair(stmt) && head(stmt) === the_tag;
}
function is_assignment(stmt) {
   return is_tagged_list(stmt, "assignment");
}
function assignment_name(stmt) {
   return head(tail(head(tail(stmt))));
}
function assignment_value(stmt) {
   return head(tail(tail(stmt)));
}

const my_assignment_statement = parse("x = 1;");
display(assignment_name(my_assignment_statement));
display(assignment_value(my_assignment_statement));