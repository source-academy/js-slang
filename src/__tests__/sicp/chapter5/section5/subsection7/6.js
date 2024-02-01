function compile_and_go(expression) {
    const instructions = assemble(statements(compile(expression, "val", "return")), "eceval");
    the-global-environment = setup-environment();
    set_register_contents("eceval", "val", instructions);
    set_register_contents("eceval", "flag", true);
    return start("eceval");
}