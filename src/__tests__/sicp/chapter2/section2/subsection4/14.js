function square_of_four(tl, tr, bl, br) {
    return painter => stack(beside(tl(painter), tr(painter)),
                            beside(bl(painter), br(painter)));
}
function identity(x) {
    return x;
}
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
    const combine4 = square_of_four(flip_horiz, identity, 
                                    turn_upside_down, flip_vert);
    return combine4(corner_split(painter, n));
}

show(square_limit(heart, 4));