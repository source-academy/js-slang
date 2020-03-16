function make_simplified_withdraw(balance) {
    return amount => {
               balance = balance - amount;
               return balance;
           };
}

const w = make_simplified_withdraw(25);

w(20);  // output: 5

w(10);  // output: -5