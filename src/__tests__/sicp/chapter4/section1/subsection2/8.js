function is_tagged_list(stmt, the_tag) {
    return is_pair(stmt) && head(stmt) === the_tag;
}
function is_conditional_expression(stmt) {
   return is_tagged_list(stmt, 
                "conditional_expression");
}
function cond_expr_pred(stmt) {
   return list_ref(stmt, 1);
}
function cond_expr_cons(stmt) {
   return list_ref(stmt, 2);
}
function cond_expr_alt(stmt) {
   return list_ref(stmt, 3);
}

const my_cond_expr = 
    parse("if (true) { 1; } else { 2; }");
display(is_conditional_expression(my_cond_expr));
display(cond_expr_pred(my_cond_expr));
display(cond_expr_cons(my_cond_expr));
display(cond_expr_alt(my_cond_expr));