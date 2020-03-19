function evaluate(stmt, env) {
   return is_self_evaluating(stmt)
          ?  stmt
        : is_name(stmt)
          ? lookup_name_value(name_of_name(stmt), env)
        : is_constant_declaration(stmt)
          ? eval_constant_declaration(stmt, env)
        : is_variable_declaration(stmt)
          ? eval_variable_declaration(stmt, env)
        : is_assignment(stmt)
          ? eval_assignment(stmt, env)
        : is_conditional_expression(stmt)
          ? eval_conditional_expression(stmt, env)
        : is_function_definition(stmt)
          ? eval_function_definition(stmt, env)
        : is_sequence(stmt)
          ? eval_sequence(sequence_statements(stmt), env)
        : is_block(stmt)
          ? eval_block(stmt, env)
        : is_return_statement(stmt)
          ? eval_return_statement(stmt, env)
        : is_application(stmt)
          ? apply(evaluate(operator(stmt), env),
                  list_of_values(operands(stmt), env))
        : error(stmt, "Unknown statement type in evaluate: ");
}

const my_program = parse("1; { true; 3; }");
evaluate(my_program, the_empty_environment);