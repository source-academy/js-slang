function make_decrementer(balance) {
    return amount => balance - amount;
}
(make_decrementer(25))(20);