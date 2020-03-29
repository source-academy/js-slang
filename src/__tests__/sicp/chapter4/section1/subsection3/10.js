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

const my_block = parse("{ let x = 1; x; }");
evaluate(my_block, the_global_environment);