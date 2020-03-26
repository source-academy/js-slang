
// functions from chapter 4, section 1.1
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
function list_of_values(exps, env) {
    if (no_operands(exps)) {
        return null;
    } else {
        return pair(evaluate(first_operand(exps), env),
                    list_of_values(rest_operands(exps), env));
   }
}
function eval_conditional_expression(stmt, env) {
    return is_true(evaluate(cond_expr_pred(stmt),
                            env))
           ? evaluate(cond_expr_cons(stmt), 
                      env)
           : evaluate(cond_expr_alt(stmt), 
                      env);
}
function eval_function_definition(stmt,env) {
    return make_compound_function(
              map(name_of_name,
                  function_definition_parameters(stmt)),
              function_definition_body(stmt),
              env);
}
function eval_sequence(stmts, env) {
    if (is_empty_sequence(stmts)) {
        return undefined;
    } else if (is_last_statement(stmts)) {
            return evaluate(first_statement(stmts),env);
    } else {
        const first_stmt_value = 
            evaluate(first_statement(stmts),env);
        if (is_return_value(first_stmt_value)) {
            return first_stmt_value;
        } else {
            return eval_sequence(
                rest_statements(stmts),env);
        }
    }
}
function eval_block(stmt, env) {
    const body = block_body(stmt);
    const locals = local_names(body);	    
    const temp_values = map(x => no_value_yet,
                            locals);
    return evaluate(body,
                extend_environment(locals, temp_values, env));
}
// We use a nullary function as temporary value for names whose
// declaration has not yet been evaluated. The purpose of the
// function definition is purely to create a unique identity;
// the function will never be applied and its return value 
// (null) is irrelevant.
const no_value_yet = () => null;
function local_names(stmt) {
    if (is_sequence(stmt)) {
        const stmts = sequence_statements(stmt);
        return is_empty_sequence(stmts)
            ? null
            : insert_all(
                  local_names(first_statement(stmts)),
                  local_names(make_sequence(
		               rest_statements(stmts))));
    } else {
       return is_constant_declaration(stmt)
           ? list(constant_declaration_name(stmt))
           : is_variable_declaration(stmt)
             ? list(variable_declaration_name(stmt))
             : null;
    }
}
function insert_all(xs, ys) {
    return is_null(xs)
        ? ys
        : is_null(member(head(xs), ys))
          ? pair(head(xs), insert_all(tail(xs), ys))
          : error(head(xs), "multiple declarations of: ");
}
function eval_return_statement(stmt, env) {
    return make_return_value(
               evaluate(return_statement_expression(stmt),
                        env));
}
function eval_assignment(stmt, env) {
    const value = evaluate(assignment_value(stmt), env);
    assign_name_value(assignment_name(stmt), value, env);
    return value;
}
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

// functions from chapter 4, section 1.2
function is_self_evaluating(stmt) {
    return is_number(stmt) ||
           is_string(stmt) || 
           is_boolean(stmt);
}
function is_name(stmt) {
    return is_tagged_list(stmt, "name");
}
function name_of_name(stmt) {
    return head(tail(stmt));
}
function is_tagged_list(stmt, the_tag) {
    return is_pair(stmt) && head(stmt) === the_tag;
}
function is_assignment(stmt) {
   return is_tagged_list(stmt, "assignment");
}
function assignment_name(stmt) {
   return head(tail(head(tail(stmt))));
}
function assignment_value(stmt) {
   return head(tail(tail(stmt)));
}
function is_constant_declaration(stmt) {
   return is_tagged_list(stmt, "constant_declaration");
}
function constant_declaration_name(stmt) {
   return head(tail(head(tail(stmt))));
}
function constant_declaration_value(stmt) {
   return head(tail(tail(stmt)));
}
function is_variable_declaration(stmt) {
   return is_tagged_list(stmt, "variable_declaration");
}
function variable_declaration_name(stmt) {
   return head(tail(head(tail(stmt))));
}
function variable_declaration_value(stmt) {
   return head(tail(tail(stmt)));
}
function is_function_definition(stmt) {
   return is_tagged_list(stmt, "function_definition");
}
function function_definition_parameters(stmt) {
   return head(tail(stmt));
}
function function_definition_body(stmt) {
   return head(tail(tail(stmt)));
}
function is_return_statement(stmt) {
   return is_tagged_list(stmt, "return_statement");
}
function return_statement_expression(stmt) {
   return head(tail(stmt));
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
function is_sequence(stmt) {
   return is_tagged_list(stmt, "sequence");
}
function make_sequence(stmts) {
   return list("sequence", stmts);
}
function sequence_statements(stmt) {   
   return head(tail(stmt));
}
function is_empty_sequence(stmts) {
   return is_null(stmts);
}
function is_last_statement(stmts) {
   return is_null(tail(stmts));
}
function first_statement(stmts) {
   return head(stmts);
}
function rest_statements(stmts) {
   return tail(stmts);
}
function is_block(stmt) {
    return is_tagged_list(stmt, "block");
}
function make_block(stmt) {
   return list("block", stmt);
}
function block_body(stmt) {
    return head(tail(stmt));
}
function is_application(stmt) {
   return is_tagged_list(stmt, "application");
}
function operator(stmt) {
   return head(tail(stmt));
}
function operands(stmt) {
   return head(tail(tail(stmt)));
}
function no_operands(ops) {
   return is_null(ops);
}
function first_operand(ops) {
   return head(ops);
}
function rest_operands(ops) {
   return tail(ops);
}

// functions from chapter 4, section 1.3
function is_true(x) {
    return x === true;
}
function make_compound_function(parameters, body, env) {
    return list("compound_function",
                parameters, body, env);
}
function is_compound_function(f) {
    return is_tagged_list(f, "compound_function");
}
function function_parameters(f) {
    return list_ref(f, 1);
}
function function_body(f) {
    return list_ref(f, 2);
}
function function_environment(f) {
    return list_ref(f, 3);
}
function make_return_value(content) {
    return list("return_value", content);
}
function is_return_value(value) {
    return is_tagged_list(value,"return_value");
}
function return_value_content(value) {
    return head(tail(value));
}
function enclosing_environment(env) {
    return tail(env);
}
function first_frame(env) {
    return head(env);
}
function enclose_by(frame, env) {    
    return pair(frame, env);
}
const the_empty_environment = null;
function is_empty_environment(env) {
    return is_null(env);
}
function make_frame(names, values) {
    return pair(names, values);
}
function frame_names(frame) {    
    return head(frame);
}
function frame_values(frame) {    
    return tail(frame);
}
function extend_environment(names, vals, base_env) {
    if (length(names) === length(vals)) {
        return enclose_by(
                   make_frame(names, 
                      map(x => pair(x, true), vals)),
                   base_env);
    } else if (length(names) < length(vals)) {
        error("Too many arguments supplied: " + 
              stringify(names) + ", " + 
              stringify(vals));
    } else {
        error("Too few arguments supplied: " + 
              stringify(names) + ", " + 
              stringify(vals));
    }
}
function lookup_name_value(name, env) {
    function env_loop(env) {
        function scan(names, vals) {
            return is_null(names)
                   ? env_loop(
                       enclosing_environment(env))
                   : name === head(names)
                     ? head(head(vals))
                     : scan(tail(names), tail(vals));
        }
        if (is_empty_environment(env)) {
            error(name, "Unbound name: ");
        } else {
            const frame = first_frame(env);
            const value =  scan(frame_names(frame),
                                frame_values(frame));
	    return value === no_value_yet
              ? error(name, "Name use before declaration: ")
              : value;
        }
    }
    return env_loop(env);
}
function assign_name_value(name, val, env) {
    function env_loop(env) {
        function scan(names, vals) {
            return is_null(names)
                ? env_loop(
                    enclosing_environment(env))
                : name === head(names)
                  ? ( tail(head(vals))
                      ? set_head(head(vals), val)
                      : error("no assignment " +
                          "to constants allowed") )
                  : scan(tail(names), tail(vals));
        } 
        if (env === the_empty_environment) {
            error(name, "Unbound name in assignment: ");
        } else {
            const frame = first_frame(env);
            return scan(frame_names(frame),
                        frame_values(frame));
        }
    }
    return env_loop(env);
}
function set_name_value(name, val, env) {
    function scan(names, vals) {
        return is_null(names)
            ? error("internal error: name not found")
            : name === head(names)
              ? set_head(head(vals), val)
              : scan(tail(names), tail(vals));
    } 
    const frame = first_frame(env);
    return scan(frame_names(frame),
                frame_values(frame));
}

// functions from chapter 4, section 1.4
function make_primitive_function(impl) {
    return list("primitive", impl);
}
function is_primitive_function(fun) {
   return is_tagged_list(fun, "primitive");
}
function primitive_implementation(fun) {
   return list_ref(fun, 1);
}
const primitive_functions = list(
       list("display",       display          ),
       list("error",         error            ),
       list("+",             (x, y) => x + y  ),
       list("-",             (x, y) => x - y  ),
       list("*",             (x, y) => x * y  ),
       list("/",             (x, y) => x / y  ),
       list("%",             (x, y) => x % y  ),
       list("===",           (x, y) => x === y),
       list("!==",           (x, y) => x !== y),
       list("<",             (x, y) => x <   y),
       list("<=",            (x, y) => x <=  y),
       list(">",             (x, y) => x >   y),
       list(">=",            (x, y) => x >=  y),
       list("!",              x     =>   !   x)
       );
const primitive_constants = list(list("undefined", undefined),
                                 list("NaN",       NaN),
                                 list("Infinity",  Infinity),
                                 list("math_PI",   math_PI)
                                );
function apply_primitive_function(fun, argument_list) {
    return apply_in_underlying_javascript(
                primitive_implementation(fun),
                argument_list);     
}
function setup_environment() {
    const primitive_function_names =
        map(f => head(f), primitive_functions);
    const primitive_function_values =
        map(f => make_primitive_function(head(tail(f))),
            primitive_functions);
    const primitive_constant_names =
        map(f => head(f), primitive_constants);
    const primitive_constant_values =
        map(f => head(tail(f)),
            primitive_constants);
    return extend_environment(
               append(primitive_function_names, 
                      primitive_constant_names),
               append(primitive_function_values, 
                      primitive_constant_values),
               the_empty_environment);
}
const the_global_environment = setup_environment();
function user_print(object) {
   return is_compound_function(object)
       ? "compound function" +
         stringify(function_parameters(object)) +
         stringify(function_body(object)) +
         "<environment>"
       : object;
}
const input_prompt = "M-Eval input: ";
const output_prompt = "M-Eval output: ";

function driver_loop(env, history) {
    const input = prompt(history + input_prompt);
    if (input === null) {
        display("session has ended");
    } else {
        const program = parse(input);
        const locals = local_names(program);	    
        const temp_values = map(x => no_value_yet,
                                locals);
        const new_env = extend_environment(locals, temp_values, env);
        const res = evaluate(program, new_env);

        driver_loop(new_env, history + "\\n" + 
                             input_prompt + input + "\\n" +
                             output_prompt + stringify(user_print(res)));
    }
}

const the_global_environment = setup_environment();
driver_loop(the_global_environment, "");