w1(50); // output: 50
const w1 = make_withdraw_with_balance(100);
const w2 = make_withdraw_with_balance(100);
function make_withdraw_with_balance(balance) {
    return amount => {
        if (balance >= amount) {
            balance = balance - amount;
            return balance;
        } else {
            return "insufficient funds";
        }
    };
}
w2(70); // output: 30