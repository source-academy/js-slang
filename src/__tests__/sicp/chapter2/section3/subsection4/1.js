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

const my_leaf = make_leaf("A", 8);

weight_leaf(my_leaf);