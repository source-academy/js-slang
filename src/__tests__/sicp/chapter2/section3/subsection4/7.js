function make_leaf(symbol, weight) {
   return list("leaf", symbol, weight);
}
function is_leaf(object) {
   return head(object) === "leaf";
}
function symbol_leaf(x) {
  return head(tail(x));
}
function weight_leaf(x) {
   return head(tail(tail(x)));
}
function make_code_tree(left,right) {
    return list(left,
                right,
                append(symbols(left), symbols(right)),
                weight(left) + weight(right));
}
function left_branch(tree) {
    return head(tree);
}
function right_branch(tree) {
    return head(tail(tree));
}
function symbols(tree) {
    return is_leaf(tree)
           ? list(symbol_leaf(tree))
           : head(tail(tail(tree)));
}
function weight(tree) {
    return is_leaf(tree)
           ? weight_leaf(tree)
           : head(tail(tail(tail(tree))));
}
const sample_tree =
    make_code_tree(make_leaf("A",4),
        make_code_tree(make_leaf("B",2),
            make_code_tree(make_leaf("D",1),
                make_leaf("C",1))));
const sample_message =						 
    list(0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0);