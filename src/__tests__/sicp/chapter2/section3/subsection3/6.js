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

entry(
  left_branch(
    right_branch(
      make_tree(10,
                null,
                make_tree(30,
                          make_tree(20,null,null),
                          null)))));