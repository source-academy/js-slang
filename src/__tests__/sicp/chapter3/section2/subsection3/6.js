function make_withdraw(initial_amount) {
    let balance = initial_amount;
    function withdraw(amount) {
        if (balance >= amount) {
            balance = balance - amount;
            return balance;
        } else {
            return "insufficient funds";
        }
    }
    return withdraw;
}