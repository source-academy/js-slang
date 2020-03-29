function is_tagged_list(stmt, the_tag) {
    return is_pair(stmt) && head(stmt) === the_tag;
}
function is_application(stmt) {
   return is_tagged_list(stmt, "application");
}
function operator(stmt) {
   return head(tail(stmt));
}
function operands(stmt) {
   return head(tail(tail(stmt)));
}
function no_operands(ops) {
   return is_null(ops);
}
function first_operand(ops) {
   return head(ops);
}
function rest_operands(ops) {
   return tail(ops);
}

const my_application = parse("math_pow(3, 4);");
display(is_application(my_application));
display(operator(my_application));
const my_operands = operands(my_application);
display(no_operands(my_operands));
display(first_operand(my_operands));
display(rest_operands(my_operands));