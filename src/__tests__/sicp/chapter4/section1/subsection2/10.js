function is_tagged_list(stmt, the_tag) {
    return is_pair(stmt) && head(stmt) === the_tag;
}
function is_block(stmt) {
    return is_tagged_list(stmt, "block");
}
function make_block(stmt) {
   return list("block", stmt);
}
function block_body(stmt) {
    return head(tail(stmt));
}

const my_block = parse("{ 1; true; 45; }");
display(is_block(my_block));
display(block_body(my_block));