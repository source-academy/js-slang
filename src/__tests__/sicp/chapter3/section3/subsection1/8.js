function make_cycle(x) {
    set_tail(last_pair(x), x);
    return x;
}
const z = make_cycle(list("a", "b", "c"));