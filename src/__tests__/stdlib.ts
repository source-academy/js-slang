import { Value } from '../types'
import { stripIndent } from '../utils/formatters'
import { expectResult, snapshotFailure } from '../utils/testing'

test.each([
  [
    1,
    `
    display('message');
    `,
    true,
    'message'
  ],

  [
    1,
    `
    error('error!');
    `,
    false,
    undefined
  ],

  [
    1,
    `
    is_undefined(undefined);
    `,
    true,
    true
  ],

  [
    2,
    `
    is_undefined(null);
    `,
    true,
    false
  ],

  [
    2,
    `
    is_null(undefined);
    `,
    true,
    false
  ],

  [
    2,
    `
    is_null(null);
    `,
    true,
    true
  ],

  [
    1,
    `
    is_string('string');
    `,
    true,
    true
  ],

  [
    1,
    `
    is_string('true');
    `,
    true,
    true
  ],

  [
    1,
    `
    is_string('1');
    `,
    true,
    true
  ],

  [
    1,
    `
    is_string(true);
    `,
    true,
    false
  ],

  [
    1,
    `
    is_string(1);
    `,
    true,
    false
  ],

  [
    1,
    `
    is_number('string');
    `,
    true,
    false
  ],

  [
    1,
    `
    is_number('true');
    `,
    true,
    false
  ],

  [
    1,
    `
    is_number('1');
    `,
    true,
    false
  ],

  [
    1,
    `
    is_number(true);
    `,
    true,
    false
  ],

  [
    1,
    `
    is_number(1);
    `,
    true,
    true
  ],

  [
    1,
    `
    is_boolean('string');
    `,
    true,
    false
  ],

  [
    1,
    `
    is_boolean('true');
    `,
    true,
    false
  ],

  [
    1,
    `
    is_boolean('1');
    `,
    true,
    false
  ],

  [
    1,
    `
    is_boolean(true);
    `,
    true,
    true
  ],

  [
    1,
    `
    is_boolean(1);
    `,
    true,
    false
  ],

  [
    1,
    `
    is_function(display);
    `,
    true,
    true
  ],

  [
    1,
    `
    is_function(x => x);
    `,
    true,
    true
  ],

  [
    1,
    `
    function f(x) {
      return x;
    }
    is_function(f);
    `,
    true,
    true
  ],

  [
    1,
    `
    is_function(1);
    `,
    true,
    false
  ],

  [
    3,
    `
    is_array(1);
    `,
    true,
    false
  ],

  [
    3,
    `
    is_array(pair(1, 2));
    `,
    true,
    true
  ],

  [
    3,
    `
    is_array([1]);
    `,
    true,
    true
  ],

  [
    100,
    `
    is_object(1);
    `,
    true,
    false
  ],

  [
    100,
    `
    is_object(pair(1, 2));
    `,
    true,
    true
  ],

  [
    100,
    `
    is_object([1]);
    `,
    true,
    true
  ],

  [
    100,
    `
    is_object({});
    `,
    true,
    true
  ],

  [
    100,
    `
    is_object({a: 1});
    `,
    true,
    true
  ],

  [
    100,
    `
    is_object(x => x);
    `,
    true,
    true
  ],

  [
    100,
    `
    is_object(display);
    `,
    true,
    true
  ],

  [
    100,
    `
    is_object(1);
    `,
    true,
    false
  ],

  [
    100,
    `
    is_object('string');
    `,
    true,
    false
  ],

  [
    100,
    `
    is_object(true);
    `,
    true,
    false
  ],

  [
    100,
    `
    is_NaN(1 / 0);
    `,
    true,
    false
  ],

  [
    100,
    `
    is_NaN(NaN);
    `,
    true,
    true
  ],

  [
    100,
    `
    is_NaN(1);
    `,
    true,
    false
  ],

  [
    100,
    `
    is_NaN(x => x);
    `,
    true,
    false
  ],

  [
    100,
    `
    has_own_property({a: 1, b: 2}, 'a');
    `,
    true,
    true
  ],

  [
    100,
    `
    has_own_property({a: 1, b: 2}, 'c');
    `,
    true,
    false
  ],

  // NOTE: OOP doesn't work because we've disabled inherited properties for security reasons
  // https://github.com/source-academy/js-slang/pull/137
  // https://github.com/source-academy/js-slang/issues/81
  // [
  //   100,
  //   `
  //   let o = {a: 1};
  //   let o2 = {b: 2};
  //   o.__proto__ = o2;
  //   o.b;
  //   `,
  //   true,
  //   2
  // ],
  //
  // [
  //   100,
  //   `
  //   let o = {a: 1};
  //   let o2 = {b: 2};
  //   o.__proto__ = o2;
  //   has_own_property(o, 'a');
  //   `,
  //   true,
  //   true
  // ],
  //
  // [
  //   100,
  //   `
  //   let o = {a: 1};
  //   let o2 = {b: 2};
  //   o.__proto__ = o2;
  //   has_own_property(o, 'b');
  //   `,
  //   true,
  //   false
  // ],

  [
    3,
    `
    array_length([1]);
    `,
    true,
    1
  ],

  [
    1,
    `
    parse_int('10', 10);
    `,
    true,
    10
  ],

  [
    1,
    `
    parse_int('10', 2);
    `,
    true,
    2
  ],

  [
    1,
    `
    is_number(runtime());
    `,
    true,
    true
  ],

  [
    1,
    `
    const start = runtime();
    function repeatUntilDifferentTime() {
      if (start === runtime()) {
        return repeatUntilDifferentTime();
      } else {
        return true;
      }
    }
    repeatUntilDifferentTime();
    `,
    true,
    true
  ],

  [
    2,
    `
    pair(1, 2);
    `,
    true,
    [1, 2]
  ],

  [
    2,
    `
    list(1, 2);
    `,
    true,
    [1, [2, null]]
  ],

  [
    2,
    `
    is_list(1);
    `,
    true,
    false
  ],

  [
    2,
    `
    is_list(pair(1, 2));
    `,
    true,
    false
  ],

  [
    2,
    `
    is_list(list(1, 2));
    `,
    true,
    true
  ],

  [
    2,
    `
    head(pair(1, 2));
    `,
    true,
    1
  ],

  [
    2,
    `
    tail(pair(1, 2));
    `,
    true,
    2
  ],

  [
    2,
    `
    head(null);
    `,
    false,
    undefined
  ],

  [
    2,
    `
    tail(null);
    `,
    false,
    undefined
  ],

  [
    2,
    `
    head(1);
    `,
    false,
    undefined
  ],

  [
    2,
    `
    tail(1);
    `,
    false,
    undefined
  ],

  [
    2,
    `
    length(list(1, 2));
    `,
    true,
    2
  ],

  [
    2,
    `
    length(1);
    `,
    false,
    undefined
  ]
] as [number, string, boolean, Value][])(
  'Builtins work as expected %#',
  (chapter: number, snippet: string, passing: boolean, returnValue: Value) => {
    if (passing) {
      return expectResult(stripIndent(snippet), { chapter, native: chapter < 100 }).toEqual(
        returnValue
      )
    } else {
      return snapshotFailure(stripIndent(snippet), { chapter }, 'fails')
    }
  }
)
