const x = pair(pair(1, pair(2,null)), pair(3, pair(4,null)));
function count_leaves(x) {
    return is_null(x)
           ? 0
           : ! is_pair(x)
             ? 1
             : count_leaves(head(x)) +
               count_leaves(tail(x));
}
count_leaves(x);
// 4