function set_to_wow(x) {
    set_head(head(x), "wow");
    return x;
}
const z2 = pair(list("a", "b"), list("a", "b"));
set_to_wow(z2); 
// displays: [["wow", ["b", null], ["a", ["b", null]]