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

make_leaf_set( list( make_leaf("A", 4),
                     make_leaf("B", 2),
                     make_leaf("C", 1),
                     make_leaf("D", 1) ) );