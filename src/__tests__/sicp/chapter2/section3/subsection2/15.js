function number_equal(exp, num) {
    return is_number(exp) && exp === num;
}
function make_sum(a1, a2) {
    return number_equal(a1, 0)
           ? a2
           : number_equal(a2, 0)
             ? a1
	     : is_number(a1) && is_number(a2)
               ? a1 + a2
               : list("+", a1, a2);
}

make_sum(2, 3);