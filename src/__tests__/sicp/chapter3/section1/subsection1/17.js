(acc("withdraw"))(60);
(acc("withdraw"))(50);
const acc = make_account(100);
function make_account(balance) {
    function withdraw(amount) {
        if (balance >= amount) {
            balance = balance - amount;
            return balance;
        } else {
            return "Insufficient funds";
        }
    }
    function deposit(amount) {
        balance = balance + amount;
        return balance;
    }
    function dispatch(m) {
        if (m === "withdraw") {
            return withdraw;
        } else if (m === "deposit") {
            return deposit;
        } else {
            return "Unknown request - - MAKE-ACCOUNT";
        }
    }
    return dispatch;
}
(acc("deposit"))(40);