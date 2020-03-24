function apply(fun, args) {
   if (is_primitive_function(fun)) {
      return apply_primitive_function(fun, args);
   } else if (is_compound_function(fun)) {
      const body = function_body(fun);
      const locals = local_names(body);
      const names = insert_all(function_parameters(fun),
                               locals);
      const temp_values = map(x => no_value_yet,
                              locals);
      const values = append(args,
                            temp_values);			   
      const result =
         evaluate(body,
                  extend_environment(
                      names,
                      values,
                      function_environment(fun)));
      if (is_return_value(result)) {
         return return_value_content(result);
      } else {
          return undefined;
      }
   } else {
      error(fun, "Unknown function type in apply");
   }
}

const plus = make_primitive_function( 
                   (x, y) => x + y
                  );
apply(plus, list(1, 2));