// operation_table, put and get
// from chapter 3 (section 3.3.3)
const operation_table = make_table();
const get = operation_table("lookup");
const put = operation_table("insert");
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
function install_rational_package() {
    // internal functions
    function numer(x) { 
        return head(x); 
    }
    function denom(x) {
        return tail(x);
    }
    function make_rat(n, d) { 
        let g = gcd(n, d);
        return pair(n / g, d / g); 
    }
    function add_rat(x, y) {
        return make_rat(numer(x) * denom(y) +
                        numer(y) * denom(x),             
                        denom(x) * denom(y));
    }
    function sub_rat(x, y) {
        return make_rat(numer(x) * denom(y) -
                        numer(y) * denom(x),             
                        denom(x) * denom(y));
    }
    function mul_rat(x, y) {
        return make_rat(numer(x) * numer(y),
                        denom(x) * denom(y));
    }
    function div_rat(x, y) {
        return make_rat(numer(x) * denom(y),
                        denom(x) * numer(y));
    }
    // interface to rest of the system
    function tag(x) {
        return attach_tag("rational", x);
    }
    put("make", "rational", make_rational);
    put("add", list("rational", "rational"), add_rational);
    put("sub", list("rational", "rational"), sub_rational);
    put("mul", list("rational", "rational"), mul_rational);
    put("div", list("rational", "rational"), div_rational);
}

function make_rational(n, d) {
    return (get("make", "rational"))(n, d);
}