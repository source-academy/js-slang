function is_variable(x) {
    return is_string(x);
}
function is_same_variable(v1, v2) {
    return is_variable(v1) && 
           is_variable(v2) && v1 === v2;
}
function deriv(exp, variable) {
    return is_number(exp)
           ? 0
           : is_variable(exp)
             ? (is_same_variable(exp, variable) ? 1 : 0)
             : get("deriv", 
                   operator(exp))(operands(exp), variable);
}
function operator(exp) {
   return head(exp);
}
function operands(exp) {
   return tail(exp);
}

deriv("x", "x");
// 1