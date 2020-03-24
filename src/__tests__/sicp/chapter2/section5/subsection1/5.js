function install_complex_package() {
    // imported functions from rectangular and polar packages	  
    function make_from_real_imag(x, y) {
        return get("make_from_real_imag", "rectangular")(x, y);
    }
    function make_from_mag_ang(r, a) {
        return get("make_from_mag_ang", "polar")(r, a);
    }

    // internal functions
    function add_complex(z1, z2) {
        return make_from_real_imag(real_part(z1) + 
                                   real_part(z2),
                                   imag_part(z1) + 
                                   imag_part(z2));
    }
    function sub_complex(z1, z2) {
        return make_from_real_imag(real_part(z1) - 
                                   real_part(z2),
                                   imag_part(z1) - 
                                   imag_part(z2));
    }
    function mul_complex(z1, z2) {
        return make_from_mag_ang(magnitude(x) * 
                                 magnitude(z2),
                                 angle(z1) + 
                                 angle(z2));
	}
    function div_complex(z1, z2) {
        return make_from_mag_ang(magnitude(x) / 
                                 magnitude(z2),
                                 angle(z1) - 
                                 angle(z2));
	}

    // interface to rest of the system
    function tag(z) {
        return attach_tag("complex", z);
    }
    put("add", list("complex", "complex"), 
        (z1, z2) => tag(add_complex(z1, z2)));
    put("sub", list("complex", "complex"), 
        (z1, z2) => tag(sub_complex(z1, z2)));
    put("mul", list("complex", "complex"), 
        (z1, z2) => tag(mul_complex(z1, z2)));
    put("div", list("complex", "complex"), 
        (z1, z2) => tag(div_complex(z1, z2)));
    put("make_from_real_imag", "complex", 
        (x, y) => tag(make_from_real_imag(x, y)));
    put("make_from_mag_ang", "complex", 
        (r, a) => tag(make_from_mag_ang(r, a)));
    return "done";    
}
function make_complex_from_real_imag(x, y){
   return get("make_from_real_imag", "complex")(x, y);
}
function make_complex_from_mag_ang(r, a){
   return get("make_from_mag_ang", "complex")(r, a);
}