function entry(tree) {
   return head(tree);
}
function left_branch(tree) {
   return head(tail(tree));
}
function right_branch(tree) {
   return head(tail(tail(tree)));
}
function make_tree(entry,left,right) {
   return list(entry,left,right);
}
function tree_to_list_1(tree) {
    return is_null(tree)
           ? null
           : append(tree_to_list_1(left_branch(tree)),
                    pair(entry(tree),
                         tree_to_list_1(right_branch(tree))));
}