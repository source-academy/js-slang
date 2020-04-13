function make_interval(x, y) { 
    return pair(x, y); 
}
function lower_bound(i) { 
    return head(i);
}
function upper_bound(i) { 
    return tail(i);
}
function print_interval(i) {
    return "[ "  + stringify(lower_bound(i)) + 
           " , " + stringify(upper_bound(i)) + " ]";
}
function add_interval(x, y) {
    return make_interval(lower_bound(x) + lower_bound(y),
                         upper_bound(x) + upper_bound(y));
}

print_interval(add_interval(make_interval(1, 2), 
                            make_interval(3, 5)));