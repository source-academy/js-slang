function is_tagged_list(stmt, the_tag) {
    return is_pair(stmt) && head(stmt) === the_tag;
}
function make_primitive_function(impl) {
    return list("primitive", impl);
}
function is_primitive_function(fun) {
   return is_tagged_list(fun, "primitive");
}
function primitive_implementation(fun) {
   return list_ref(fun, 1);
}

const my_primitive_plus =
    make_primitive_function( (x, y) => x + y );	    
display(is_primitive_function(my_primitive_plus));
display(primitive_implementation(my_primitive_plus));