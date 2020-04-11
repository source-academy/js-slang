function eval_return_statement(stmt, env) {
    return make_return_value(
               evaluate(return_statement_expression(stmt),
                        env));
}

const my_program = parse("{ function f() { return 1; } f(); }");
evaluate(my_program, the_global_environment);