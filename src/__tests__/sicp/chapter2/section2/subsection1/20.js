// first_denomination, except_first_denomination
// and no_more to be given by student
function cc(amount, coin_values) {
    return amount === 0
           ? 1
           : amount < 0 || no_more(coin_values)
             ? 0
             : cc(amount,
	          except_first_denomination(coin_values))
               +
               cc(amount - first_denomination(coin_values), 
                  coin_values);
}

cc(100, us_coins);