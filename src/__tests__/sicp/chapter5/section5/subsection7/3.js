function start_cse_eval() {
    the_global_environment = setup_environment();
    set_register_contents(cse-eval, "flag", false);
    return start(cse-eval);
}