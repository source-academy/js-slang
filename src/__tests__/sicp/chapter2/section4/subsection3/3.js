// In Source, most functions have a fixed number of arguments.
// (The function list is the only exception, to this so far.)
// The function apply_in_underlying_javascript allows us to
// apply any given function fun to all elements of the argument 
// list args, as if they were separate arguments
function apply(fun, args) {
    return apply_in_underlying_javascript(fun, args);
}
function apply_generic(op, args) {
    const type_tags = map(type_tag, args);
    const fun = get(op, type_tags);
    return fun !== undefined
        ? apply(fun, map(contents, args))
        : Error("No method for these types in apply_generic",
                list(op, type_tags));
}