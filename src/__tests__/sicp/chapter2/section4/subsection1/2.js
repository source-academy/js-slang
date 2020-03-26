function add_complex(z1, z2) {
    return make_from_real_imag(
               real_part(z1) + real_part(z2),
               imag_part(z1) + imag_part(z2));
}
function sub_complex(z1, z2) {
    return make_from_real_imag(
               real_part(z1) - real_part(z2),
               imag_part(z1) - imag_part(z2));
}
function mul_complex(z1, z2) {
    return make_from_mag_ang(
               magnitude(z1) * magnitude(z2),
               angle(z1) + angle(z2));
}
function div_complex(z1, z2) {
    return make_from_mag_ang(
               magnitude(z1) / magnitude(z2),
               angle(z1) - angle(z2));
}
function square(x) {
    return x * x;
}
function real_part(z) {
    return magnitude(z) * math_cos(angle(z));
}
function imag_part(z) {
    return magnitude(z) * math_sin(angle(z));
}
function magnitude(z) {
    return head(z);
}
function angle(z) {
    return tail(z);
}
function make_from_real_imag(x, y) {
    return pair(math_sqrt(square(x) + square(y)),
                math_atan2(y, x));
}
function make_from_mag_ang(r, a) {
    return pair(r, a);
}

const my_co_num_1 = make_from_real_imag(2.5, -0.5);
const my_co_num_2 = make_from_real_imag(2.5, -0.5);

const result = add_complex(my_co_num_1, 
                   mul_complex(my_co_num_2, 
                       my_co_num_2));

imag_part(result);