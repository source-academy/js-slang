const d = make_decrementer(25);
function make_decrementer(balance) {
    return amount => balance - amount;
}
d(20); // output: 5