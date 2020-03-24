function square_of_four(tl, tr, bl, br) {
    return painter => stack(beside(tl(painter), tr(painter)),
                            beside(bl(painter), br(painter)));
}
function identity(x) {
    return x;
}
const flipped_pairs =
    square_of_four(turn_upside_down, flip_vert, 
                   flip_horiz, identity);

show(flipped_pairs(heart));