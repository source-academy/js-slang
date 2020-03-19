function install_javascript_number_package() {
    function tag(x) {
        return attach_tag("javascript_number", x);
    }
    put("add", list("javascript_number", "javascript_number"), 
        (x, y) => tag(x + y));
    put("sub", list("javascript_number", "javascript_number"), 
        (x, y) => tag(x - y));
    put("mul", list("javascript_number", "javascript_number"), 
        (x, y) => tag(x * y));
    put("div", list("javascript_number", "javascript_number"), 
        (x, y) => tag(x / y));
    put("make", "javascript_number", 
        x => tag(x));
    return "done";
}
function make_javascript_number(n) {
    return get("make", "javascript_number")(n);
}