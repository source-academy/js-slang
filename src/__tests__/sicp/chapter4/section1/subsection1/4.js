function eval_conditional_expression(stmt, env) {
    return is_true(evaluate(cond_expr_pred(stmt),
                            env))
           ? evaluate(cond_expr_cons(stmt), 
                      env)
           : evaluate(cond_expr_alt(stmt), 
                      env);
}

const my_cond_expr = parse("if (true) { 1; } else { 2; }");
eval_conditional_expression(my_cond_expr, the_empty_environment);