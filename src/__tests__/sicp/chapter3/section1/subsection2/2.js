function make_rand() {
   let x = random_init;
   function rand() {
        x = rand_update(x);
        return x;
   }
   return rand;
}
const rand = make_rand();
function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
}
function estimate_pi(trials) {
    return math_sqrt(6 / monte_carlo(trials, cesaro_test));
}

function cesaro_test() {
    return gcd(rand(), rand()) === 1;
}

function monte_carlo(trials, experiment) {
    function iter(trials_remaining, trials_passed) {
        if (trials_remaining === 0) {
            return trials_passed / trials;
        } else if (experiment()) {
            return iter(trials_remaining - 1,
                        trials_passed + 1);
        } else {
            return iter(trials_remaining - 1, 
                        trials_passed);
        }
    }
    return iter(trials, 0);
}

estimate_pi(1000);