import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { testSuccess } from '../../utils/testing'
import * as list from '../list'

test('display_list is linear runtime', () => {
  const placeholder = Symbol('placeholder')
  const noDisplayList = (v: any, s: any = placeholder) => {
    if (s !== placeholder && typeof s !== 'string') {
      throw new TypeError('display_list expects the second argument to be a string')
    }
    return list.rawDisplayList((x: any) => x, v, s === placeholder ? undefined : s)
  }

  return expect(
    testSuccess(
      stripIndent`
      const build_inf = (i, f) => {
        const t = list(f(i));
        let p = t;
        for (let n = i - 1; n >= 0; n = n - 1) {
          p = pair(f(n), p);
        }
        set_tail(t, p);
        return p;
      };
      const make_complex_list = n => {
        // makes a complex list structure with O(n) pairs
        const cuberootn = math_floor(math_pow(n, 0.33));
        return build_list(cuberootn, _ => build_inf(cuberootn, _ => build_list(cuberootn, i =>i)));
      };
      const time_display_list = xs => {
        const starttime = get_time();
        no_display_list(xs);
        return get_time() - starttime;
      };

      // Warm up
      time_display_list(make_complex_list(5000));

      // measure
      const ns = [
        // 10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000
        // ^-- times 3
        14000, 10000, 20000, 15000, 17000, 11000, 13000, 12000, 15000, 12000, 19000, 10000, 13000, 14000, 12000, 18000, 17000, 13000, 19000, 16000, 18000, 18000, 20000, 20000, 16000, 11000, 16000, 10000, 17000, 15000, 19000, 11000, 14000
        ];
      const xvalues = [];
      const yvalues = [];
      for (let i = 0; i < array_length(ns); i = i + 1) {
        const xs = make_complex_list(ns[i]);
        const t = time_display_list(xs);
        xvalues[i] = math_log(ns[i]);
        yvalues[i] = math_log(t);
      }

      // linear regression adapted from https://dracoblue.net/dev/linear-least-squares-in-javascript/
      function findLineByLeastSquares(values_x, values_y) {
        let sum_x = 0;
        let sum_y = 0;
        let sum_xy = 0;
        let sum_xx = 0;
        let count = 0;

        /*
         * We'll use those variables for faster read/write access.
         */
        let x = 0;
        let y = 0;
        let values_length = array_length(values_x);

        /*
         * Nothing to do.
         */
        if (values_length === 0) {
            return [ [], [] ];
        } else {}

        /*
         * Calculate the sum for each of the parts necessary.
         */
        for (let v = 0; v < values_length; v = v + 1) {
            x = values_x[v];
            y = values_y[v];
            sum_x  = sum_x + x;
            sum_y  = sum_y + y;
            sum_xx = sum_xx + x*x;
            sum_xy = sum_xy + x*y;
            count = count + 1;
        }

        /*
         * Calculate m and b for the formular:
         * y = x * m + b
         */
        let m = (count*sum_xy - sum_x*sum_y) / (count*sum_xx - sum_x*sum_x);
        let b = (sum_y/count) - (m*sum_x)/count;

        return pair(m, b);
      }

      // best fit
      const line = findLineByLeastSquares(xvalues, yvalues);
      const slope = head(line);
      slope;
    `,
      {
        chapter: Chapter.SOURCE_3,
        native: false, // we're measuring a builtin, no need for native
        testBuiltins: {
          no_display_list: noDisplayList
        }
      }
    ).then(testResult => testResult.result)
  ).resolves.toBeLessThan(1.2)
  // estimated power is less than 1.2
  // means it's probably near 1
  // => probably linear?
}, 1000000)
