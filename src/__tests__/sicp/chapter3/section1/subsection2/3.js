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
    return math_sqrt(6 / random_gcd_test(trials, random_init));
}

function random_gcd_test(trials, initial_x) {
    function iter(trials_remaining, trials_passed, x) {
        const x1 = rand_update(x);
        const x2 = rand_update(x1);
        if (trials_remaining === 0) {
            return trials_passed / trials;
        } else if (gcd(x1, x2) === 1) {
            return iter(trials_remaining - 1, 
                        trials_passed + 1, x2);
        } else {
            return iter(trials_remaining - 1, 
                        trials_passed, x2);
        }
    }
    return iter(trials, 0, initial_x);
}

estimate_pi(1000);