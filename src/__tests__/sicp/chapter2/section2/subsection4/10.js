function corner_split(painter, n) {
    if (n === 0) {
       return painter;
    } else {
       const up = up_split(painter, n - 1);
       const right = right_split(painter, n - 1);
       const top_left = beside(up, up);
       const bottom_right = stack(right, right);
       const corner = corner_split(painter, n - 1);
       return stack(beside(top_left, corner),
                    beside(painter, bottom_right));
    }
}
function right_split(painter, n) {
    if (n === 0) {
        return painter;
    } else {
        const smaller = right_split(painter, n - 1);
        return beside(painter, stack(smaller, smaller));
    }
}
function up_split(painter, n) {
    if (n === 0) {
        return painter;
    } else {
        const smaller = up_split(painter, n - 1);
        return stack(beside(smaller, smaller), painter);
    }
}
function square_limit(painter, n) {
    const quarter = corner_split(painter, n);
    const upper_half = beside(flip_horiz(quarter), quarter);
    const lower_half = beside(turn_upside_down(quarter),
                              flip_vert(quarter));
    return stack(upper_half, lower_half);
}

show(square_limit(heart, 5));