function average(x,y) {
    return (x + y) / 2;
}
function positive(x) { return x > 0; }
function negative(x) { return x < 0; }
function close_enough(x,y) {
    return abs(x - y) < 0.001;
}
function abs(x) {
    return x >= 0 ? x : -x;
}
function search(f, neg_point, pos_point) {
    const midpoint = average(neg_point,pos_point);
    if (close_enough(neg_point, pos_point)) {
        return midpoint;
    } else {
        const test_value = f(midpoint);
        if (positive(test_value)) {
            return search(f, neg_point, midpoint);
        } else if (negative(test_value)) {
            return search(f, midpoint, pos_point);
        } else {
            return midpoint;
        }
    }
}

search(x => x * x - 1, 0, 2);