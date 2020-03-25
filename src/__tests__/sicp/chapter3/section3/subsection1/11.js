function mystery(x) {
    function loop(x, y) {
        if (is_null(x)) {
            return y;
        } else {
            let temp = tail(x);
            set_tail(x, y);
            return loop(temp, x);
        }
    }
    return loop(x, null);
}
const v = list("a", "b", "c");
const w = mystery(v);