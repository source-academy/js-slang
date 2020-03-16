function count_change(amount) {
    return cc(amount, 5);
}
function cc(amount, kinds_of_coins) {
    return amount === 0
           ? 1
           : amount < 0 ||
             kinds_of_coins === 0
             ? 0
             : cc(amount, kinds_of_coins - 1)
               +
               cc(amount - first_denomination(
                               kinds_of_coins),
                  kinds_of_coins);
}
function first_denomination(kinds_of_coins) {
    return kinds_of_coins === 1 ? 1 :
           kinds_of_coins === 2 ? 5 :
           kinds_of_coins === 3 ? 10 :
           kinds_of_coins === 4 ? 25 :
           kinds_of_coins === 5 ? 50 : 0;
}

count_change(100);