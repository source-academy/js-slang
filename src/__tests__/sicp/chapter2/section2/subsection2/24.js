function scale_tree(tree, factor) {
    return map(sub_tree => is_pair(sub_tree)
                           ? scale_tree(sub_tree, factor)
                           : sub_tree * factor, 
               tree);
}

scale_tree(list(1, list(2, list(3, 4), 5), list(6, 7)),
           10);