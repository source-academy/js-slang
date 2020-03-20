function eval_function_definition(stmt,env) {
    return make_compound_function(
              map(name_of_name,
                  function_definition_parameters(stmt)),
              function_definition_body(stmt),
              env);
}

const my_fun = parse("x => x * x;");
eval_function_definition(my_fun, the_empty_environment);