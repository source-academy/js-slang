// operation_table, put and get
// from chapter 3 (section 3.3.3)
const operation_table = make_table();
const get = operation_table("lookup");
const put = operation_table("insert");
function assoc(key, records) {
    return is_null(records)
           ? undefined
           : is_equal(key, head(head(records)))
             ? head(records)
             : assoc(key, tail(records));
}
function is_equal(a, b) {
    return (is_pair(a) && is_pair(b) &&
            is_equal(head(a), head(b)) && is_equal(tail(a), tail(b)))
           || 
           a === b;
}
function make_table() {
    const local_table = list("*table*");
    function lookup(key_1, key_2) {
        const subtable = assoc(key_1, tail(local_table));
        if (subtable === undefined) {
            return undefined;
        } else {
            const record = assoc(key_2, tail(subtable));
            if (record === undefined) {
                return undefined;
            } else {
                return tail(record);
            }
        }
    }
    function insert(key_1, key_2, value) {
        const subtable = assoc(key_1, tail(local_table));
        if (subtable === undefined) {
            set_tail(local_table,
                     pair(list(key_1, pair(key_2, value)),
                          tail(local_table)));
        } else {
            const record = assoc(key_2, tail(subtable));
            if (record === undefined) {
      	        set_tail(subtable,
	                       pair(pair(key_2, value),
                              tail(subtable)));
	    } else {
                set_tail(record, value);
            }
        }
    }
    function dispatch(m) {
        return m === "lookup"
               ? lookup
               : m === "insert"
                 ? insert
                 : "undefined operation -- table";
    }
    return dispatch;
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