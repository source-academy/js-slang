function deriv(exp, variable) {
    return is_number(exp)
           ? 0
           : is_variable(exp)
             ? (is_same_variable(exp, variable)) ? 1 : 0
             : is_sum(exp)
               ? make_sum(deriv(addend(exp), variable), 
                          deriv(augend(exp), variable))
               : is_product(exp)
                 ? make_sum(make_product(multiplier(exp), 
                                deriv(multiplicand(exp), 
                                      variable)), 
                            make_product(deriv(multiplier(exp), 
                                            variable), 
                                         multiplicand(exp)))
                 : Error("unknown expression type in deriv", 
                         exp);
}
deriv(list("*", list("*", "x", "y"), list("+", "x", 3)), "x");
// [ "+",
//   [["*", ["x", ["y", null]]], 
//    [["*", ["y", [["+", ["x", [3, null]]], null]]], null]] ]