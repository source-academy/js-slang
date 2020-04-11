// A very simple rand_update function computes a 
// number from 0 (inclusive) to 2^31 (exclusive) 
// from a value x by multiplying it with a constant a, 
// adding a constant c. We used it here for illustration
// only, and do not claim any statistical properties.
const m = math_pow(2, 31); 
const a = 1103515245;
const c = 12345;

function rand_update(x) {
    return (a * x + c) % m;
}
const random_init = 123456789;
function make_rand() {
   let x = random_init;
   function rand() {
        x = rand_update(x);
        return x;
   }
   return rand;
}
const rand = make_rand();

display(rand());
display(rand());
display(rand());