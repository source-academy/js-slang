function square(x) {
    return x * x;
}
// THIS IS NOT A CORRECT SOLUTION
function square_list(items) {
   function iter(things, answer) {
       return is_null(things)
              ? answer
              : iter(tail(things), 
                     pair(answer, 
                          square(head(things))));
   }
   return iter(items, null);
}

square_list(list(1, 2, 3, 4));
// returns: [1, [4, [9, [16, null]]]]