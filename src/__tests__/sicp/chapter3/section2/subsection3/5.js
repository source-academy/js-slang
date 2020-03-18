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
const w2 = make_withdraw(100);