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

extend_environment(list("x", "y", "z"),
                   list(1, 2, 3),
                   the_empty_environment);