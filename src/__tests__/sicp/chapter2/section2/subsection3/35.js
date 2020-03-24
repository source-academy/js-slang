function make_pair_sum(pair) {
    return list(head(pair), head(tail(pair)), 
                head(pair) + head(tail(pair)));
}

make_pair_sum(list(8, 9));