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
function eval_block(stmt, env) {
    const body = block_body(stmt);
    const locals = local_names(body);	    
    const temp_values = map(x => no_value_yet,
                            locals);
    return evaluate(body,
                extend_environment(locals, temp_values, env));
}

const my_block = parse("{ true; 3; 42; }");
eval_block(my_block, the_empty_environment);