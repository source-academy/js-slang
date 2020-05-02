function insert_all(xs, ys) {
    return is_null(xs)
        ? ys
        : is_null(member(head(xs), ys))
          ? pair(head(xs), insert_all(tail(xs), ys))
          : error(head(xs), "multiple declarations of: ");
}
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

local_names(parse("const x = 1; let y = 2;"));