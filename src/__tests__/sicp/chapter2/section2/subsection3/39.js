function flatmap(f, seq) {
    return accumulate(append, null, map(f, seq));
}
function enumerate_interval(low, high) {
    return low > high
           ? null
           : pair(low,
                  enumerate_interval(low + 1, high));
}
function queens(board_size) {
    function queen_cols(k) {
        return k === 0
               ? list(empty_board)
               : filter(
                     positions => is_safe(k, positions), 
                     flatmap(rest_of_queens => 
			     map(new_row => adjoin_position(
                                             new_row, k,
                                             rest_of_queens), 
                                 enumerate_interval(1, 
                                     board_size)),
			     queen_cols(k - 1)));
   }
   return queen_cols(board_size);
}

queens(8);