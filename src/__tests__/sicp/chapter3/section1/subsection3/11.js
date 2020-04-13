function make_simplified_withdraw(balance) {
    return amount => {
               balance = balance - amount;
               return balance;
           };
}
const w1 = make_simplified_withdraw(25);

const w2 = make_simplified_withdraw(25);