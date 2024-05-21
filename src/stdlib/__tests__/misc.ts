import { Chapter } from '../../types'
import { expectParsedErrorsToEqual, expectResultsToEqual } from '../../utils/testing/testers'

describe('Test regular function', () => {
  expectResultsToEqual([
    // arity
    [
      'arity with nullary function is ok',
      'arity(math_random);',
      0
    ],
    [
      'arity with function with parameters is ok',
      'arity(arity);',
      1
    ],
    [
      'arity ignores the rest parameter',
      'arity(display);',
      1
    ],
    [
      'arity with user-made function is ok',
      `
        function test(x, y) { return x; }
        arity(test);
      `,
      2
    ],
    [
      'arity with user-made lambda function is ok',
      `
        const test = (x, y) => x;
        arity(test);
      `,
      2
    ],
    [
      'arity with user-made nullary function is ok',
      'arity(() => undefined);',
      0
    ],
    [
      'arity with user-made function with rest parameter is ok',
      `
        function test(...args) { return 0; }
        arity(test);
      `,
      0
    ],

    // char_at
    [
      'char_at with valid args is ok',
      'char_at("123", 0);',
      '1'
    ],
    [
      'char_at with valid args (but index out of bounds) returns undefined',
      'char_at("123", 3);',
      undefined
    ],

    // parse_int
    [
      'parse_int with valid args is ok',
      "parse_int('1100101010101', 2);",
      parseInt('1100101010101', 2)
    ],
    [
      'parse_int with valid args is ok, radix 36',
      "parse_int('uu1', 36);",
      parseInt('uu1', 36)
    ],
    [
      'parse_int with valid args is ok, but invalid str for radix',
      "parse_int('uu1', 2);",
      parseInt('uu1', 2)
    ]
  ], Chapter.SOURCE_3)
})

describe('Test errors', () => {
  expectParsedErrorsToEqual([
    [
      'arity with non-function arg f throws error',
      'arity("function");',
      "Line 1: Error: arity expects a function as argument"
    ],

    // char_at    
    [
      'char_at with non string first argument errors',
      'char_at(42, 123);',
      "Line 1: Error: char_at expects the first argument to be a string."
    ],
    [
      'char_at with non nonnegative integer second argument errors 1',
      "char_at('', -1);",
      "Line 1: Error: char_at expects the second argument to be a nonnegative integer."
    ],
    [
      'char_at with non nonnegative integer second argument errors',
      `char_at('', "");`,
      "Line 1: Error: char_at expects the second argument to be a nonnegative integer."
    ],

    // parse_int
    [
      'parse_int with non-string arg str throws error',
      'parse_int(42, 2);',
      "Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."
    ],
    [
      'parse_int with non-integer arg radix throws error',
      'parse_int(42, 2.1);',
      "Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."
    ],
    [
      'parse_int with radix outside [2, 36] throws error, radix=1', 
      "parse_int('10', 1);",
      "Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."
    ],
    [
      'parse_int with radix outside [2, 36] throws error, radix=37',
      "parse_int('10', 37);",
      "Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."
    ],
    [
      'parse_int with string arg radix throws error',
      "parse_int(42, '2');",
      "Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."
    ]
  ], Chapter.SOURCE_3)
})
