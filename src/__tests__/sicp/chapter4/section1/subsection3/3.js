function is_tagged_list(stmt, the_tag) {
    return is_pair(stmt) && head(stmt) === the_tag;
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

const my_return_value = make_return_value(42);
display(is_return_value(my_return_value));
display(return_value_content(my_return_value));