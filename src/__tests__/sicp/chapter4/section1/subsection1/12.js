function eval_variable_declaration(stmt, env) {
    set_name_value(variable_declaration_name(stmt),
        evaluate(variable_declaration_value(stmt), env),
        env);
}   
function eval_constant_declaration(stmt, env) {
    set_name_value(constant_declaration_name(stmt),
        evaluate(constant_declaration_value(stmt), env),
        env);
}

const my_program = parse("{ let x = 1; const y = 2; x + y; }");
evaluate(my_program, the_global_environment);