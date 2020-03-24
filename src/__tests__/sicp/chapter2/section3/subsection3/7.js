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
function is_element_of_set(x, set) {
    return ! is_null(set) &&
           ( x === entry(set) ||
             ( x < entry(set)
               ? is_element_of_set(x, left_branch(set))
               : is_element_of_set(x, right_branch(set))
             )
           );
}

is_element_of_set(20, 
    make_tree(10,
        null,
        make_tree(30,
            make_tree(20, null, null),
            null)));