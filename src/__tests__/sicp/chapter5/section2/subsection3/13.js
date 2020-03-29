function is_operation_exp(exp) {
    return is_pair(exp) && is_tagged_list(head(exp), "op");
}

function operation_exp_op(operation_exp) {
    return head(tail(head(operation_exp)));
}

function operation_exp_operands(operation_exp) {
    return tail(operation_exp);
}