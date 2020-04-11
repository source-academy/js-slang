function make_decrementer(balance) {
    return amount => balance - amount;
}
const d = make_decrementer(25);