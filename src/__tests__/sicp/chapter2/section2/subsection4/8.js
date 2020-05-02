function right_split(painter, n) {
    if (n === 0) {
        return painter;
    } else {
        const smaller = right_split(painter, n - 1);
        return beside(painter, stack(smaller, smaller));
    }
}
show(right_split(heart, 4));