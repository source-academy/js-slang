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

const my_block = parse("{ let x = 1; x = 2; }");
evaluate(my_block, the_global_environment);