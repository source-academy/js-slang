function make_decrementer(balance) {
    return amount => balance - amount;
}
const d1 = make_decrementer(25);

const d2 = make_decrementer(25);