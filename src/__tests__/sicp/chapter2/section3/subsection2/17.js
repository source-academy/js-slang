function number_equal(exp, num) {
    return is_number(exp) && exp === num;
}
function make_product(m1, m2) {
    return number_equal(m1, 0) || number_equal(m2, 0)
           ? 0
           : number_equal(m1, 1)
             ? m2
             : number_equal(m2, 1)
             ? m1
             : is_number(m1) && is_number(m2)
               ? m1 * m2
               : list("*", m1, m2);
}

make_product(2, 3);