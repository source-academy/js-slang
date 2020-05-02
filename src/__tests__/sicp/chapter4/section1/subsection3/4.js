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

is_empty_environment(the_empty_environment);