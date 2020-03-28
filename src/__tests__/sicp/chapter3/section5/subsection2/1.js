function integers_starting_from(n) {
    return pair(n,
                () => integers_starting_from(n + 1)
               );
}

eval_stream(integers_starting_from(7), 30);