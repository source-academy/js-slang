// We use a nullary function as temporary value for names whose
// declaration has not yet been evaluated. The purpose of the
// function definition is purely to create a unique identity;
// the function will never be applied and its return value 
// (null) is irrelevant.
const no_value_yet = () => null;
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

const my_environment =
    extend_environment(list("x", "y", "z"),
                       list(1, 2, 3),
                       the_empty_environment);

lookup_name_value("x", my_environment);