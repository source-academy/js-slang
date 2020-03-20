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
function list_to_tree(elements) {
   return head(partial_tree(elements,length(elements)));
}
function partial_tree(elts, n) {
    if (n === 0) {
       return pair(null,elts);
    } else {
       const left_size = math_floor((n - 1) / 2);
       const left_result = partial_tree(elts, left_size);
       const left_tree = head(left_result);
       const non_left_elts = tail(left_result);
       const right_size = n - (left_size + 1);
       const this_entry = head(non_left_elts);
       const right_result = partial_tree(tail(non_left_elts),
                                         right_size);
       const right_tree = head(right_result);
       const remaining_elts = tail(right_result);
       return pair(make_tree(this_entry, 
                             left_tree, 
                             right_tree),
                   remaining_elts);
    }
}

list_to_tree(list(10, 20, 30));