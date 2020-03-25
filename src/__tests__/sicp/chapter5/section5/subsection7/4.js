function user_print(object) {
    if (compound_procedure(object)) {
        display(list(
            "compound_procedure",
            procedure_parameters(object),
            procedure_body(object),
            "<compiler-env>"));
    } else if (compiled_procedure(object)) {
        display("<compiler-procedure>");
    } else {
        display(object);
    }
}