function list_of_values(exps, env) {
    if (no_operands(exps)) {
        return null;
    } else {
        return pair(evaluate(first_operand(exps), env),
                    list_of_values(rest_operands(exps), env));
   }
}

const my_addition_expression = parse("1 + 2;");
list_of_values(list(1, my_addition_expression, 7),
               the_global_environment);