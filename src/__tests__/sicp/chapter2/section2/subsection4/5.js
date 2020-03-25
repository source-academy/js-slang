function flipped_pairs(painter) {
    const painter2 = beside(painter, flip_vert(painter));
    return stack(painter2, painter2);
}
const heart4 = flipped_pairs(heart);