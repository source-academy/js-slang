function attach_tag(type_tag, contents) {
    return pair(type_tag, contents);
}
function type_tag(datum) {
    return is_pair(datum)
           ? head(datum)
           : Error("bad tagged datum in type_tag", datum);
}
function contents(datum) {
    return is_pair(datum)
           ? tail(datum)
           : Error("bad tagged datum in contents", datum);
}
function square(x) {
    return x * x;
}
function real_part_rectangular(z) {
    return head(z);
}
function imag_part_rectangular(z) {
    return tail(z);
}
function magnitude_rectangular(z) {
    return math_sqrt(square(real_part_rectangular(z))
           +
           square(imag_part_rectangular(z)));
}
function angle_rectangular(z) {
    return math_atan(imag_part_rectangular(z),
                real_part_rectangular(z));
}
function make_from_real_imag_rectangular(x, y) {
    return attach_tag("rectangular",
                      pair(x, y));
}
function make_from_mag_ang_rectangular(r, a) {
    return attach_tag("rectangular",
                      pair(r * math_cos(a), r * math_sin(a)));
}

const bens_co_num = make_from_mag_ang_rectangular(	  
                      3.0, 0.7);

imag_part_rectangular(contents(bens_co_num));