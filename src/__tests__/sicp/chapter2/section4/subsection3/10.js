function make_from_real_imag(x, y) {
    function dispatch(op) {
        return op === "real_part"
            ? x
            : op === "imag_part"
              ? y
              : op === "magnitude"
                ? math_sqrt(square(x) + square(y))
                : op === "angle"
                  ? math_atan(y, x)
                  : Error("Unknown op in make_from_real_imag", 
                          op);
    }
    return dispatch;
}
function square(x) {
    return x * x;
}
function real_part(z) {
   return apply_generic("real_part", list(z));
}
function imag_part(z) {
   return apply_generic("imag_part", list(z));
}
function magnitude(z) {
   return apply_generic("magnitude", list(z));
}
function angle(z) {
   return apply_generic("angle", list(z));
}
function apply_generic(op, arg) {
    return head(arg)(op);
}

const my_complex_number = 
    make_from_real_imag(1.0, 4.5);

const result = 
    add_complex(my_complex_number,
                my_complex_number);

imag_part(result);