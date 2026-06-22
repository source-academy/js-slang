import { expect, test } from 'vitest';
import { runCodeInSource } from '../../runner';
import { mockContext } from '../../utils/testing/mocks';
import { Chapter } from '../../langs';
import { parseError } from '../..';
import { parse } from '../../parser/parser';
import { generate } from 'astring';
import { transpile } from '../../transpiler/transpiler';

test('oh no', async () => {
  const context = mockContext(Chapter.SOURCE_4);
  const program = parse(
// `function equal(xs, ys) {
//   return is_pair(xs)
//   ? (is_pair(ys) &&
//     equal(head(xs), head(ys)) &&
//     equal(tail(xs), tail(ys)))
//   : is_null(xs)
//   ? is_null(ys)
//   : is_number(xs)
//   ? (is_number(ys) && xs === ys)
//   : is_boolean(xs)
//   ? (is_boolean(ys) && ((xs && ys) || (!xs && !ys)))
//   : is_string(xs)
//   ? (is_string(ys) && xs === ys)
//   : is_undefined(xs)
//   ? is_undefined(ys)
//   : is_function(xs)
//     // we know now that xs is a function,
//     // but we use an if check anyway to make use of the type predicate
//   ? (is_function(ys) && xs === ys)
//   : false;
// }`,
    `
      function equal(xs, ys) {
        return is_pair(xs)
        ? (
          is_pair(ys) && equal(head(xs), head(ys)) && equal(tail(xs), tail(ys))
        )
        : is_null(xs);
      }
    `,
    // `equal(map(x => 2 * x, list(12, 11, 3)), list(24, 22, 6));`,
    context
  );

  const { transpiled } = transpile(program!, context, false)
  console.log(transpiled);

})