function eval_assignment(stmt, env) {
    const value = evaluate(assignment_value(stmt), env);
    assign_name_value(assignment_name(stmt), value, env);
    return value;
}

const my_program = parse("{ let x = 1; x = 2; }");
evaluate(my_program, the_global_environment);