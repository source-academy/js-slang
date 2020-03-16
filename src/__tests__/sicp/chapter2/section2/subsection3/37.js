function flatmap(f, seq) {
    return accumulate(append, null, map(f, seq));
}
function permutations(s) {
    return is_null(s)
           ? list(null)
           : flatmap(x => map(p => pair(x, p),
                              permutations(remove(x, s))),
                     s);
}

permutations(list(1, 2, 3));