function append(x, y) {
    return is_null(x)
           ? y
           : pair(head(x), append(tail(x), y));
}
function append_mutator(x, y) {
    set_tail(last_pair(x), y);
}
const x = list("a", "b");
const y = list("c", "d");
const z = append(x, y);
display(z);       // ["a", ["b", ["c", ["d", null]]]]
display(tail(x)); // ???
const w = append_mutator(x, y);
display(w);       // ["a", ["b", ["c", ["d", null]]]]
display(tail(x)); // ???