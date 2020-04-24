/* tslint:disable:max-line-length */
import { expectResult } from '../../utils/testing'

// Examples taken from SICP to ensure normal programs
// don't get detected as infinite loops

test('examples from chapter1 no false positives 1', () => {
  const works = `
    function square(x) {
        return x * x;
    }

    function sum_of_squares(x,y) {
        return square(x) + square(y);
    }

    function f(a) {
        return sum_of_squares(a + 1, a * 2);
    }

    f(5);

    function not_equal(x, y) {
        return !(x >= y && x <= y);
    }

    not_equal(7, 4);

    function fib(n) {
        return n === 0
               ? 0
               : n === 1
                 ? 1
                 : fib(n - 1) + fib(n - 2);
    }

    fib(6);


    function plus(a, b) { return a + b; }
    function minus(a, b) { return a - b; }
    function a_plus_abs_b(a, b) {
        return (b >= 0 ? plus : minus)(a, b);
    }

    a_plus_abs_b(5, -4);


    function abs(x) {
        return x >= 0 ? x : -x;
    }

    function good_enough(guess, x) {
        return abs(square(guess) - x) < 0.001;
    }

    function average(x,y) {
        return (x + y) / 2;
    }

    function improve(guess, x) {
        return average(guess, x / guess);
    }

    function sqrt_iter(guess, x) {
        return good_enough(guess, x)
               ? guess
               : sqrt_iter(improve(guess, x), x);
    }

    function sqrt(x) {
        return sqrt_iter(1, x);
    }

    sqrt(9);


    function fib2(n) {
        return fib_iter(1, 0, n);
    }
    function fib_iter(a, b, count) {
        return count === 0
               ? b
               : fib_iter(a + b, a, count - 1);
    }

    fib2(6);

    function A(x,y) {
        return y === 0
               ? 0
               : x === 0
                 ? 2 * y
                 : y === 1
                   ? 2
                   : A(x - 1, A(x, y - 1));
    }

    A(1, 10);

          `
  return expectResult(works).toMatchSnapshot()
})

test('examples from chapter1 no false positives 2', () => {
  const works = `
    function average(n,m){
        return (n+m)/2;
    }
    function abs(n){
        return n>0?n:-n;
    }
    function square(n) {
        return n*n;
    }



        function cube(x) {
            return x * x * x;
        }
        function p(x) {
            return 3 * x - 4 * cube(x);
        }
        function sine(angle) {
            return !(abs(angle) > 0.1)
                   ? angle
                   : p(sine(angle / 3.0));
        }

        sine(math_PI / 2);

        function expt(b,n) {
            return expt_iter(b,n,1);
        }
        function expt_iter(b,counter,product) {
            return counter === 0
                   ? product
                   : expt_iter(b,
                               counter - 1,
                               b * product);
        }

        expt(3, 4);

        function expt2(b,n) {
            return n === 0
                   ? 1
                   : b * expt2(b, n - 1);
        }

        expt2(3, 4);

        function is_even(n) {
            return n % 2 === 0;
        }

        function fast_expt(b, n) {
            return n === 0
                   ? 1
                   : is_even(n)
                     ? square(fast_expt(b, n / 2))
                     : b * fast_expt(b, n - 1);
        }

        fast_expt(3, 4);

        function gcd(a, b) {
            return b === 0 ? a : gcd(b, a % b);
        }

        gcd(20, 12);

        function smallest_divisor(n) {
            return find_divisor(n, 2);
        }
        function find_divisor(n, test_divisor) {
             return square(test_divisor) > n
                    ? n
                    : divides(test_divisor, n)
                      ? test_divisor
                      : find_divisor(n, test_divisor + 1);
        }
        function divides(a, b) {
            return b % a === 0;
        }

        function is_prime(n) {
            return n === smallest_divisor(n);
        }

        is_prime(42);
          `
  return expectResult(works).toMatchSnapshot()
})

test('examples from chapter1 no false positives 3', () => {
  const works = `
    function average(n,m){
        return (n+m)/2;
    }
    function abs(n){
        return n>0?n:-n;
    }
    function is_even(n){
        return n%2===0;
    }
    function square(n) {
        return n*n;
    }
    function cube(n) {
        return n*n*n;
    }
    function is_prime(n) {
        return n === smallest_divisor(n);
    }
    function smallest_divisor(n) {
        return find_divisor(n, 2);
    }
    function find_divisor(n, test_divisor) {
         return square(test_divisor) > n
                ? n
                : divides(test_divisor, n)
                  ? test_divisor
                  : find_divisor(n, test_divisor + 1);
    }
    function divides(a, b) {
        return b % a === 0;
    }

        function expmod(base, exp, m) {
            return exp === 0
                   ? 1
                   : is_even(exp)
                     ? square(expmod(base, exp / 2, m)) % m
                     : (base * expmod(base, exp - 1, m)) % m;
        }
        expmod(4, 3, 5);

        function expmod3(base, exp, m) {
            if (exp === 0) {
                return 1;
            } else {
                if (is_even(exp)) {
                    const to_half = expmod3(base, exp / 2, m);
                    return to_half * to_half % m;
                } else {
                    return base * expmod3(base, exp - 1, m) % m;
                }
            }
        }

        expmod3(4, 3, 5);

        function random(n) {
            return math_floor(math_random() * n);
        }

        function fermat_test(n) {
            function try_it(a) {
                return expmod(a, n, n) === a;
            }
            return try_it(1 + random(n - 1));
        }

        function fast_is_prime(n, times) {
            return times === 0
                   ? true
                   : fermat_test(n)
                     ? fast_is_prime(n, times - 1)
                     : false;
        }

        fast_is_prime(91, 3);

        function timed_prime_test(n) {
            return start_prime_test(n, runtime());
        }
        function start_prime_test(n, start_time) {
            return is_prime(n)
                   ? report_prime(runtime() - start_time)
                   : true;
        }
        function report_prime(elapsed_time) {
            display(" *** ");
        }

        timed_prime_test(43);



        function pi_sum(a, b) {
            return a > b
                   ? 0
                   : 1.0 / (a * (a + 2)) +
                     pi_sum(a + 4, b);
        }

        8 * pi_sum(1, 100);

        function sum(term, a, next, b) {
            return a > b
                   ? 0
                   : term(a) + sum(term, next(a), next, b);
        }

        function inc(n) {
            return n + 1;
        }
        function sum_cubes(a, b) {
            return sum(cube, a, inc, b);
        }

        sum_cubes(1, 10);

        function pi_sum2(a, b) {
            function pi_term(x) {
                return 1.0 / (x * (x + 2));
            }
            function pi_next(x) {
                return x + 4;
            }
            return sum(pi_term, a, pi_next, b);
        }

        8 * pi_sum2(1, 100);

        function integral(f, a, b, dx) {
            function add_dx(x) {
                return x + dx;
            }
            return sum(f, a + dx / 2, add_dx, b) * dx;
        }

        integral(cube, 0, 1, 0.1);

        function pi_sum3(a,b) {
            return sum(x => 1.0 / (x * (x + 2)),
                       a,
                       x => x + 4,
                       b);
        }

        8 * pi_sum3(1, 100);

        function integral2(f, a, b, dx) {
            return sum(f,
                       a + dx / 2.0,
                       x => x + dx,
                       b)
                   *
                   dx;
        }

        integral2(cube, 0, 1, 0.1);

        function f2(x, y) {
            function f_helper(a, b) {
                return x * square(a) +
                       y * b +
                       a * b;
            }
            return f_helper(1 + x * y,
                            1 - y);
        }

        f2(3, 4);


        function positive(x) { return x > 0; }
        function negative(x) { return x < 0; }

        function close_enough(x,y) {
            return abs(x - y) < 0.01;
        }

        function search(f, neg_point, pos_point) {
            const midpoint = average(neg_point,pos_point);
            if (close_enough(neg_point, pos_point)) {
                return midpoint;
            } else {
                const test_value = f(midpoint);
                if (positive(test_value)) {
                    return search(f, neg_point, midpoint);
                } else if (negative(test_value)) {
                    return search(f, midpoint, pos_point);
                } else {
                    return midpoint;
                }
            }
        }

        search(x => x * x - 1, 0, 2);

        function half_interval_method(f, a, b) {
            const a_value = f(a);
            const b_value = f(b);
            return negative(a_value) && positive(b_value)
                   ? search(f, a, b)
                   : negative(b_value) && positive(a_value)
                     ? search(f, b, a)
                     : error("values are not of opposite sign");
        }

        half_interval_method(math_sin, 2.0, 4.0);


        const tolerance = 0.00001;
        function fixed_point(f, first_guess) {
            function close_enough(x, y) {
                return abs(x - y) < tolerance;
            }
            function try_with(guess) {
                const next = f(guess);
                return close_enough(guess, next)
                       ? next
                       : try_with(next);
            }
            return try_with(first_guess);
        }

        fixed_point(math_cos, 1.0);

        function average_damp(f) {
            return x => average(x, f(x));
        }

        function sqrt2(x) {
            return fixed_point(average_damp(y => x / y),
                               1.0);
        }

        sqrt2(6);

        const dx = 0.0001;

        function deriv(g) {
            return x => (g(x + dx) - g(x)) / dx;
        }

        function newton_transform(g) {
           return x => x - g(x) / deriv(g)(x);
        }
        function newtons_method(g, guess) {
           return fixed_point(newton_transform(g), guess);
        }

        function sqrt3(x) {
            return newtons_method(y => square(y) - x,
                                  1.0);
        }

        sqrt3(6);

        function fixed_point_of_transform(g, transform, guess) {
            return fixed_point(transform(g), guess);
        }

        function sqrt4(x) {
            return fixed_point_of_transform(
                       y => square(y) - x,
                       newton_transform,
                       1.0);
        }

        sqrt4(6);
        0;
          `
  return expectResult(works).toMatchSnapshot()
})

test('examples from chapter1 no false positives coin change', () => {
  const works = `
    function count_change(amount) {
        return cc(amount, 5);
    }
    function cc(amount, kinds_of_coins) {
        return amount === 0
               ? 1
               : amount < 0 ||
                 kinds_of_coins === 0
                 ? 0
                 : cc(amount, kinds_of_coins - 1)
                   +
                   cc(amount - first_denomination(
                                   kinds_of_coins),
                      kinds_of_coins);
    }
    function first_denomination(kinds_of_coins) {
        return kinds_of_coins === 1 ? 1 :
               kinds_of_coins === 2 ? 5 :
               kinds_of_coins === 3 ? 10 :
               kinds_of_coins === 4 ? 25 :
               kinds_of_coins === 5 ? 50 : 0;
    }

    count_change(10);
          `
  return expectResult(works).toMatchSnapshot()
})
