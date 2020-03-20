function real_part(z) {
    return is_rectangular(z)
           ? real_part_rectangular(contents(z))
           : is_polar(z)
             ? real_part_polar(contents(z))
             : Error("Unknown type in real_part", z);
}
function imag_part(z) {
    return is_rectangular(z)
           ? imag_part_rectangular(contents(z))
           : is_polar(z)
             ? imag_part_polar(contents(z))
             : Error("Unknown type in imag_part", z);
}
function magnitude(z) {
    return is_rectangular(z)
           ? magnitude_rectangular(contents(z))
           : is_polar(z)
             ? magnitude_polar(contents(z))
             : Error("Unknown type in magnitude", z);
}
function angle(z) {
    return is_rectangular(z)
           ? angle_rectangular(contents(z))
           : is_polar(z)
             ? angle_polar(contents(z))
             : Error("Unknown type in angle", z);
}
function is_rectangular(z) {
    return type_tag(z) === "rectangular";
}
function is_polar(z) {
    return type_tag(z) === "polar";
}
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
function square(x) {
    return x * x;
}
function real_part_polar(z) {
    return magnitude_polar(z) * math_cos(angle_polar(z));
}
function imag_part_polar(z) {
    return magnitude_polar(z) * math_sin(angle_polar(z));
}
function magnitude_polar(z) {
    return head(z);
}
function angle_polar(z) {
    return tail(z);
}
function make_from_real_imag_polar(x, y) {
    return attach_tag("polar",
                     pair(math_sqrt(square(x) + square(y)),
                          math_atan(y, z)));
}
function make_from_mag_ang_polar(r, a) {
    return attach_tag("polar",
                      pair(r, a));
}
function make_from_real_imag(x, y) {
    return make_from_real_imag_rectangular(x, y);
}
function make_from_mag_ang(r, a) {
    return make_from_mag_ang_polar(r, a);
}

const alyssas_co_num = make_from_mag_ang(	  
                           3.0, 0.7);

imag_part(alyssas_co_num);