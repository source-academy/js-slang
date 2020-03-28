function make_leaf_set(pairs) {
   if (is_null(pairs)) {
      return null;
   }
   else {
      const first_pair = head(pairs);
      return adjoin_set(
                 make_leaf(head(first_pair),        // symb
                           head(tail(first_pair))), // freq
                 make_leaf_set(tail(pairs)));
   }
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
// successive_merge function to be written by student
function generate_huffman_tree(pairs) {
   return successive_merge(make_leaf_set(pairs));
}