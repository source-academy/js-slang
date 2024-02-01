function start_eceval() {
    the_global_environment = setup_environment();
    set_register_contents(eceval, "flag", false);
    return start(eceval);
}