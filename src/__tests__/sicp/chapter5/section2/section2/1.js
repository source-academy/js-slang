function gcd_machine() {
    return make_machine(list("a", "b", "t"),
                        list(list("rem", binary_function((a, b) => a % b)),
                             list("=", binary_function((a, b) => a === b))),
                        list("test-b",
                             test(op("="), reg("b"), constant(0)),
                             branch(label("gcd-done")),
                             assign("t", list(op("rem"), reg("a"), reg("b"))),
                             assign("a", list(reg("b"))),
                             assign("b", list(reg("t"))),
                             go_to(label("test-b")),
                             "gcd-done"));
}