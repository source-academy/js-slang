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
function adjoin_set(x,set) {
    return is_null(set)
           ? make_tree(x, null, null)
           : x === entry(set)
             ? set
             : x < entry(set)
               ? make_tree(entry(set),
                     adjoin_set(x, left_branch(set)),
                     right_branch(set))
               : make_tree(entry(set),
                     left_branch(set),
                     adjoin_set(x, right_branch(set)));
}

adjoin_set(10, adjoin_set(15, adjoin_set(20, null)));