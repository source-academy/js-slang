function compile_and_go(expression) {
    const instructions = assemble(statements(compile(expression, "val", "return")), "cse-eval");
    the-global-environment = setup-environment();
    set_register_contents("cse-eval", "val", instructions);
    set_register_contents("cse-eval", "flag", true);
    return start("cse-eval");
}