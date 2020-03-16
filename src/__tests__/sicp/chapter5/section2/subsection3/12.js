function make_operation_exp(exp, machine, labels, operations) {
    const op = lookup_prim(operation_exp_op(exp), operations);
    const aprocs = map(e => make_primitive_exp(e, machine, labels),
                       operation_exp_operands(exp));

    function perform_make_operation_exp() {
        return op(map(p => p(), aprocs));
    }
    
    return perform_make_operation_exp;
}