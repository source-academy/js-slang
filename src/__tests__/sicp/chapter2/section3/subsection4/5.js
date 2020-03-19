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
function adjoin_set(x, set) {
    return is_null(set)
           ? list(x)
           : weight(x) < weight(head(set))
             ? pair(x, set)
             : pair(head(set), adjoin_set(x, tail(set)));
}

const my_leaf_1 = make_leaf("A", 8);
const my_leaf_2 = make_leaf("B", 3);

adjoin_set(my_leaf_1, adjoin_set(my_leaf_2, null));