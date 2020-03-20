function make_withdraw() {
    let balance = 100;
    return amount => {
        if (balance >= amount) {
            balance = balance - amount;
            return balance;
        } else {
            return "insufficient funds";
        }
    };
}
const new_withdraw = make_withdraw();

new_withdraw(60);
new_withdraw(60);