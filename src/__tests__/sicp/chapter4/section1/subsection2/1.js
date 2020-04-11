function is_self_evaluating(stmt) {
    return is_number(stmt) ||
           is_string(stmt) || 
           is_boolean(stmt);
}

const my_program = parse("true; 1;");
const my_true_statement = list_ref(my_program, 0);
display(is_self_evaluating(my_true_statement));