function pair(x, y) {
    function set_x(v) {
        x = v;
    }
    function set_y(v) {
        y = v;
    }
    return function dispatch(m) {
               if (m === "head") {
                   return x;
               } else if (m === "tail") {
                   return y;
               } else if (m === "set_head") {
                   return set_x;
               } else if (m === "set_tail") {
                   return set_y;
               } else {
                   return "undefined operation - - pair";
               }
           };
}
    
function head(z) {
    return z("head");
}

function tail(z) {
    return z("tail");
}

function set_head(z, new_value) {
    (z("set_head"))(new_value);
    return z;
}

function set_tail(z, new_value) {
    (z("set_tail"))(new_value);
    return z;
}