import { Chapter, Value } from '../types'
import { stripIndent } from '../utils/formatters'
import { expectResult, snapshotFailure } from '../utils/testing'

test.each([
  [
    Chapter.SOURCE_1,
    `
    display('message');
    `,
    true,
    'message'
  ],

  [
    Chapter.SOURCE_1,
    `
    error('error!');
    `,
    false,
    undefined
  ],

  [
    Chapter.SOURCE_1,
    `
    is_undefined(undefined);
    `,
    true,
    true
  ],

  [
    Chapter.SOURCE_2,
    `
    is_undefined(null);
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_2,
    `
    is_null(undefined);
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_2,
    `
    is_null(null);
    `,
    true,
    true
  ],

  [
    Chapter.SOURCE_1,
    `
    is_string('string');
    `,
    true,
    true
  ],

  [
    Chapter.SOURCE_1,
    `
    is_string('true');
    `,
    true,
    true
  ],

  [
    Chapter.SOURCE_1,
    `
    is_string('1');
    `,
    true,
    true
  ],

  [
    Chapter.SOURCE_1,
    `
    is_string(true);
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_1,
    `
    is_string(1);
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_1,
    `
    is_number('string');
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_1,
    `
    is_number('true');
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_1,
    `
    is_number('1');
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_1,
    `
    is_number(true);
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_1,
    `
    is_number(1);
    `,
    true,
    true
  ],

  [
    Chapter.SOURCE_1,
    `
    is_boolean('string');
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_1,
    `
    is_boolean('true');
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_1,
    `
    is_boolean('1');
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_1,
    `
    is_boolean(true);
    `,
    true,
    true
  ],

  [
    Chapter.SOURCE_1,
    `
    is_boolean(1);
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_1,
    `
    is_function(display);
    `,
    true,
    true
  ],

  [
    Chapter.SOURCE_1,
    `
    is_function(x => x);
    `,
    true,
    true
  ],

  [
    Chapter.SOURCE_1,
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
    Chapter.SOURCE_1,
    `
    is_function(1);
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_3,
    `
    is_array(1);
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_3,
    `
    is_array(pair(1, 2));
    `,
    true,
    true
  ],

  [
    Chapter.SOURCE_3,
    `
    is_array([1]);
    `,
    true,
    true
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_object(1);
    `,
    true,
    false
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_object(pair(1, 2));
    `,
    true,
    true
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_object([1]);
    `,
    true,
    true
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_object({});
    `,
    true,
    true
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_object({a: 1});
    `,
    true,
    true
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_object(x => x);
    `,
    true,
    true
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_object(display);
    `,
    true,
    true
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_object(1);
    `,
    true,
    false
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_object('string');
    `,
    true,
    false
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_object(true);
    `,
    true,
    false
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_NaN(1 / 0);
    `,
    true,
    false
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_NaN(NaN);
    `,
    true,
    true
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_NaN(1);
    `,
    true,
    false
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    is_NaN(x => x);
    `,
    true,
    false
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    has_own_property({a: 1, b: 2}, 'a');
    `,
    true,
    true
  ],

  [
    Chapter.LIBRARY_PARSER,
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
    Chapter.SOURCE_3,
    `
    array_length([1]);
    `,
    true,
    1
  ],

  [
    Chapter.SOURCE_1,
    `
    parse_int('10', 10);
    `,
    true,
    10
  ],

  [
    Chapter.SOURCE_1,
    `
    parse_int('10', 2);
    `,
    true,
    2
  ],

  [
    Chapter.SOURCE_1,
    `
    is_number(get_time());
    `,
    true,
    true
  ],

  [
    Chapter.SOURCE_1,
    `
    const start = get_time();
    function repeatUntilDifferentTime() {
      if (start === get_time()) {
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
    Chapter.SOURCE_2,
    `
    pair(1, 2);
    `,
    true,
    [1, 2]
  ],

  [
    Chapter.SOURCE_2,
    `
    list(1, 2);
    `,
    true,
    [1, [2, null]]
  ],

  [
    Chapter.SOURCE_2,
    `
    is_list(1);
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_2,
    `
    is_list(pair(1, 2));
    `,
    true,
    false
  ],

  [
    Chapter.SOURCE_2,
    `
    is_list(list(1, 2));
    `,
    true,
    true
  ],

  [
    Chapter.SOURCE_2,
    `
    head(pair(1, 2));
    `,
    true,
    1
  ],

  [
    Chapter.SOURCE_2,
    `
    tail(pair(1, 2));
    `,
    true,
    2
  ],

  [
    Chapter.SOURCE_2,
    `
    head(null);
    `,
    false,
    undefined
  ],

  [
    Chapter.SOURCE_2,
    `
    tail(null);
    `,
    false,
    undefined
  ],

  [
    Chapter.SOURCE_2,
    `
    head(1);
    `,
    false,
    undefined
  ],

  [
    Chapter.SOURCE_2,
    `
    tail(1);
    `,
    false,
    undefined
  ],

  [
    Chapter.SOURCE_2,
    `
    length(list(1, 2));
    `,
    true,
    2
  ],

  [
    Chapter.SOURCE_2,
    `
    length(1);
    `,
    false,
    undefined
  ]
] as [Chapter, string, boolean, Value][])(
  'Builtins work as expected %#',
  (chapter: Chapter, snippet: string, passing: boolean, returnValue: Value) => {
    if (passing) {
      return expectResult(stripIndent(snippet), {
        chapter,
        native: chapter !== Chapter.LIBRARY_PARSER
      }).toEqual(returnValue)
    } else {
      return snapshotFailure(stripIndent(snippet), { chapter }, 'fails')
    }
  }
)
