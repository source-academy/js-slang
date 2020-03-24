const heart2 = beside(heart, flip_vert(heart)); // (a)
const heart4 = stack(heart2, heart2);           // (b)

show(heart4);