import { Chapter, Variant } from '../../types'
import { stripIndent } from '../../utils/formatters'
import {
  expectDisplayResult,
  expectParsedError,
  expectResult,
  expectVisualiseListResult,
  getDisplayResult,
  snapshotSuccess
} from '../../utils/testing'

// concurrent programs return undefined so use display
// for tests instead
// all tests assumes display works
// comments mention additional opcodes tested by test code
describe('standard opcodes', () => {
  test('LGCI works', () => {
    return expectDisplayResult(`display(123);`, {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "123",
              ]
            `)
  })

  test('LGCF64 works', () => {
    return expectDisplayResult(`display(1.5);`, {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "1.5",
              ]
            `)
  })

  test('LGCB0 works', () => {
    return expectDisplayResult(`display(false);`, {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "false",
              ]
            `)
  })

  test('LGCB1 works', () => {
    return expectDisplayResult(`display(true);`, {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "true",
              ]
            `)
  })

  test('LGCU works', () => {
    return expectDisplayResult(`display(undefined);`, {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "undefined",
              ]
            `)
  })

  test('LGCN works', () => {
    return expectDisplayResult(`display(null);`, {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "null",
              ]
            `)
  })

  test('LGCS works', () => {
    return expectDisplayResult(`display("test string");`, {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "\\"test string\\"",
              ]
            `)
  })

  test('ADDG works for numbers', () => {
    return expectDisplayResult('display(-1+1);', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "0",
              ]
            `)
  })

  test('ADDG works for strings', () => {
    return expectDisplayResult('display("first"+"second");', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "\\"firstsecond\\"",
              ]
            `)
  })

  test('ADDG fails for ill-typed operands', () => {
    return expectParsedError('1+undefined;', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(
      `"Error: execution aborted: Expected string and string or number and number, got number and undefined for +."`
    )
  })

  test('SUBG works for numbers', () => {
    return expectDisplayResult('display(123-124);', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "-1",
              ]
            `)
  })

  test('SUBG fails for ill-typed operands', () => {
    return expectParsedError('1-undefined;', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(
      `"Error: execution aborted: Expected number and number, got number and undefined for -."`
    )
  })

  test('MULG works for numbers', () => {
    return expectDisplayResult('display(123*2);', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "246",
              ]
            `)
  })

  test('MULG fails for ill-typed operands', () => {
    return expectParsedError('1*undefined;', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(
      `"Error: execution aborted: Expected number and number, got number and undefined for *."`
    )
  })

  test('DIVG works for numbers', () => {
    return expectDisplayResult('display(128/32);', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "4",
              ]
            `)
  })

  test('DIVG fails for division by 0', () => {
    return expectParsedError('128/0;', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`"Error: execution aborted: division by 0"`)
  })

  test('DIVG fails for ill-typed operands', () => {
    return expectParsedError('1/undefined;', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(
      `"Error: execution aborted: Expected number and number, got number and undefined for /."`
    )
  })

  test('MODG works for numbers', () => {
    return expectDisplayResult('display(128%31);', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "4",
              ]
            `)
  })

  test('MODG fails for ill-typed operands', () => {
    return expectParsedError('1%undefined;', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(
      `"Error: execution aborted: Expected undefined, got undefined for undefined."`
    )
  })

  test('NEGG works', () => {
    return expectDisplayResult('display(-1);display(-(-1));', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "-1",
                "1",
              ]
            `)
  })

  test('NEGG fails for ill-typed operands', () => {
    return expectParsedError('-"hi";', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`"Error: execution aborted: Expected number, got string for -."`)
  })

  test('NOTG works', () => {
    return expectDisplayResult('display(!false);display(!true);', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "true",
                "false",
              ]
            `)
  })

  test('NOTG fails for ill-typed operands', () => {
    return expectParsedError('!1;', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`"Error: execution aborted: Expected boolean, got number for !."`)
  })

  test('LTG works for numbers', () => {
    return expectDisplayResult('display(5 < 10); display(10 < 5);', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "true",
                "false",
              ]
            `)
  })

  test('LTG works for strings', () => {
    return expectDisplayResult('display("abc" < "bcd"); display("bcd" < "abc");', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "true",
                "false",
              ]
            `)
  })

  test('LTG fails for ill-typed operands', () => {
    return expectParsedError('1<undefined;', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(
      `"Error: execution aborted: Expected string and string or number and number, got number and undefined for <."`
    )
  })

  test('GTG works for numbers', () => {
    return expectDisplayResult('display(5 > 10); display(10 > 5);', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "false",
                "true",
              ]
            `)
  })

  test('GTG works for strings', () => {
    return expectDisplayResult('display("abc" > "bcd"); display("bcd" > "abc");', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "false",
                "true",
              ]
            `)
  })

  test('GTG fails for ill-typed operands', () => {
    return expectParsedError('1>undefined;', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(
      `"Error: execution aborted: Expected string and string or number and number, got number and undefined for >."`
    )
  })

  test('LEG works for numbers', () => {
    return expectDisplayResult(
      stripIndent`
        display(5 <= 10);
        display(5 <= 5);
        display(10 <= 5);
        `,
      {
        chapter: Chapter.SOURCE_3,
        variant: Variant.CONCURRENT
      }
    ).toMatchInlineSnapshot(`
              Array [
                "true",
                "true",
                "false",
              ]
            `)
  })

  test('LEG works for strings', () => {
    return expectDisplayResult(
      stripIndent`
        display('abc' <= 'bcd');
        display('abc' <= 'abc');
        display('bcd' <= 'abc');
        `,
      {
        chapter: Chapter.SOURCE_3,
        variant: Variant.CONCURRENT
      }
    ).toMatchInlineSnapshot(`
              Array [
                "true",
                "true",
                "false",
              ]
            `)
  })

  test('LEG fails for ill-typed operands', () => {
    return expectParsedError('1<=undefined;', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(
      `"Error: execution aborted: Expected string and string or number and number, got number and undefined for <=."`
    )
  })

  test('GEG works for numbers', () => {
    return expectDisplayResult(
      stripIndent`
        display(5 >= 10);
        display(5 >= 5);
        display(10 >= 5);
        `,
      {
        chapter: Chapter.SOURCE_3,
        variant: Variant.CONCURRENT
      }
    ).toMatchInlineSnapshot(`
              Array [
                "false",
                "true",
                "true",
              ]
            `)
  })

  test('GEG works for numbers', () => {
    return expectDisplayResult(
      stripIndent`
        display('abc' >= 'bcd');
        display('abc' >= 'abc');
        display('bcd' >= 'abc');
        `,
      {
        chapter: Chapter.SOURCE_3,
        variant: Variant.CONCURRENT
      }
    ).toMatchInlineSnapshot(`
              Array [
                "false",
                "true",
                "true",
              ]
            `)
  })

  test('GEG fails for ill-typed operands', () => {
    return expectParsedError('1>=undefined;', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(
      `"Error: execution aborted: Expected string and string or number and number, got number and undefined for >=."`
    )
  })

  // NEWC, CALL, RETG
  test('function and function calls work', () => {
    return expectDisplayResult(
      stripIndent`
        function f(x) {
          display(x);
          return 1;
        }
        display(f(3));
        display(f);
        `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "3",
                "1",
                "\\"<Function>\\"",
              ]
            `)
  })

  test('STLG and LDLG works', () => {
    return expectDisplayResult(`const x = 1; display(x);`, {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "1",
              ]
            `)
  })

  // NEWA, LDAG, STAG, DUP
  test('array opcodes work', () => {
    return expectDisplayResult(`const x = [1,2,3,1]; display(x[1]); display(x[8]);`, {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "2",
                "undefined",
              ]
            `)
  })

  test('LDAG fails for non-array', () => {
    return expectParsedError('1[0];', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(
      `"Error: execution aborted: Expected array, got number for array access."`
    )
  })

  test('LDAG fails for ill-typed argument', () => {
    return expectParsedError('const arr = []; arr["hi"];', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(
      `"Error: execution aborted: Expected number, got string for array index."`
    )
  })

  test('STAG fails for non-array', () => {
    return expectParsedError('0[1] = 1;', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(
      `"Error: execution aborted: Expected array, got number for array access."`
    )
  })

  test('STAG fails for ill-typed argument', () => {
    return expectParsedError('const arr = []; arr["hi"] = 1;', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(
      `"Error: execution aborted: Expected number, got string for array index."`
    )
  })

  test('EQG works', () => {
    return expectDisplayResult(
      stripIndent`
          const x = [1,2];
          const f = () => {};
          const y = test_and_set;
          const z = list;
          display(undefined === undefined &&
          null === null &&
          null !== undefined &&
          true === true &&
          false === false &&
          false !== true &&
          1 === 1 &&
          -1 === -1 &&
          x !== [1,2] &&
          x === x &&
          f === f &&
          f !== (() => {}) &&
          'stringa' === 'stringa' &&
          'stringa' !== 'stringb' &&
          true !== null &&
          y !== z &&
          z === list &&
          y === test_and_set &&
          0 !== "0");
          `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "true",
              ]
            `)
  })

  test('LDPG and STPG work', () => {
    return expectDisplayResult(
      stripIndent`
        let x = 1;
        display(x);
        function f() {
          x = 3;
        }
        f();
        display(x);
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "1",
                "3",
              ]
            `)
  })

  test('BRF works', () => {
    return expectDisplayResult(
      stripIndent`
        if (true) {
          display('did not BRF');
        } else {}
        if (false) {} else {
          display('BRF');
        }
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "\\"did not BRF\\"",
                "\\"BRF\\"",
              ]
            `)
  })

  test('BRF works, no else', () => {
    return expectDisplayResult(
      stripIndent`
        if (true) {
          display('did not BRF');
        }
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "\\"did not BRF\\"",
              ]
            `)
  })

  test('BRF works, no else 2', () => {
    return expectDisplayResult(
      stripIndent`
        if (false) {
          display("should not show");
        }
        display("should show");
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "\\"should show\\"",
              ]
            `)
  })

  // BR, NEWENV, POPENV
  test('while loops works', () => {
    return expectDisplayResult(
      stripIndent`
        let x = 0;
        const y = 'before NEWENV';
        display(y);
        while (x < 1) {
          const y = 'after NEWENV';
          display(y);
          x = x + 1;
          display('before BR');
        }
        display('after POPENV');
        display('after BR');
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "\\"before NEWENV\\"",
                "\\"after NEWENV\\"",
                "\\"before BR\\"",
                "\\"after POPENV\\"",
                "\\"after BR\\"",
              ]
            `)
  })
})

describe('primitive opcodes', () => {
  describe('self-implemented', () => {
    test('DISPLAY works for circular references', () => {
      return expectDisplayResult(
        stripIndent`
          const p = pair(1,2);
          const q = pair(3,4);
          set_head(q,p);
          set_tail(p,q);
          display(p);
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "[1, [...<circular>, 4]]",
                ]
              `)
    })

    test('DISPLAY throws error if no arguments', () => {
      return expectParsedError(
        stripIndent`
          display();
        `,
        {
          chapter: Chapter.SOURCE_3,
          variant: Variant.CONCURRENT
        }
      ).toMatchInlineSnapshot(`"Error: \\"Expected 1 or more arguments, but got 0.\\""`)
    })

    test('ARRAY_LEN works', () => {
      return expectDisplayResult(
        stripIndent`
          const arr = [];
          const arr1 = [1,2,3];
          const p = pair(1,2);
          display(array_length(arr));
          display(array_length(arr1));
          arr[100] = 100;
          display(array_length(arr));
          display(array_length(p));
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "0",
                  "3",
                  "101",
                  "2",
                ]
              `)
    })

    test('ARRAY_LEN fails for ill-typed argument', () => {
      return expectParsedError('array_length(1);', {
        chapter: Chapter.SOURCE_3,
        variant: Variant.CONCURRENT
      }).toMatchInlineSnapshot(
        `"Error: execution aborted: Expected array, got number for array_length."`
      )
    })

    test('DRAW_DATA works', () => {
      return expectVisualiseListResult(
        stripIndent`
          draw_data(pair(true, [1]));
          draw_data(null, list(undefined, 2), "3");
        `,
        {
          chapter: Chapter.SOURCE_3,
          variant: Variant.CONCURRENT
        }
      ).toMatchInlineSnapshot(`
                Array [
                  Array [
                    Array [
                      true,
                      Array [
                        1,
                      ],
                    ],
                  ],
                  Array [
                    null,
                    Array [
                      undefined,
                      Array [
                        2,
                        null,
                      ],
                    ],
                    "3",
                  ],
                ]
              `)
    })

    test('DRAW_DATA returns correct values', () => {
      return expectDisplayResult(
        stripIndent`
          display(draw_data(pair(true, [1])));
          display(draw_data(null, list(undefined, 2), "3"));
        `,
        {
          chapter: Chapter.SOURCE_3,
          variant: Variant.CONCURRENT
        }
      ).toMatchInlineSnapshot(`
                Array [
                  "[true, [1]]",
                  "null",
                ]
              `)
    })

    test('DRAW_DATA throws error if no arguments', () => {
      return expectParsedError(
        stripIndent`
          draw_data();
        `,
        {
          chapter: Chapter.SOURCE_3,
          variant: Variant.CONCURRENT
        }
      ).toMatchInlineSnapshot(`"Error: \\"Expected 1 or more arguments, but got 0.\\""`)
    })

    test('ERROR works', () => {
      return expectParsedError('error(123);', {
        chapter: Chapter.SOURCE_3,
        variant: Variant.CONCURRENT
      }).toMatchInlineSnapshot(`"Error: 123"`)
    })

    test('IS_ARRAY works', () => {
      return expectDisplayResult(
        stripIndent`
          display(is_array([1,2]));
          display(is_array(1));
        `,
        {
          chapter: Chapter.SOURCE_3,
          variant: Variant.CONCURRENT
        }
      ).toMatchInlineSnapshot(`
                Array [
                  "true",
                  "false",
                ]
              `)
    })

    test('IS_BOOL works', () => {
      return expectDisplayResult(
        stripIndent`
          display(is_boolean(true));
          display(is_boolean(1));
        `,
        {
          chapter: Chapter.SOURCE_3,
          variant: Variant.CONCURRENT
        }
      ).toMatchInlineSnapshot(`
                Array [
                  "true",
                  "false",
                ]
              `)
    })

    test('IS_FUNC works', () => {
      return expectDisplayResult(
        stripIndent`
          display(is_function(() => {}));
          display(is_function(1));
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "true",
                  "false",
                ]
              `)
    })

    test('IS_NULL works', () => {
      return expectDisplayResult(
        stripIndent`
          display(is_null(null));
          display(is_null(1));
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "true",
                  "false",
                ]
              `)
    })

    test('IS_NUMBER works', () => {
      return expectDisplayResult(
        stripIndent`
          display(is_number(1));
          display(is_number(false));
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "true",
                  "false",
                ]
              `)
    })

    test('IS_STRING works', () => {
      return expectDisplayResult(
        stripIndent`
          display(is_string("string"));
          display(is_string(1));
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "true",
                  "false",
                ]
              `)
    })

    test('IS_UNDEFINED works', () => {
      return expectDisplayResult(
        stripIndent`
          display(is_undefined(undefined));
          display(is_undefined(1));
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "true",
                  "false",
                ]
              `)
    })

    // variadic test as well
    test('MATH_HYPOT works', () => {
      return expectDisplayResult(
        stripIndent`
          display(math_hypot(3,4));
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "5",
                ]
              `)
    })

    test('DISPLAY_LIST works', () => {
      return expectDisplayResult(
        stripIndent`
          display_list(pair(1, null));
          display_list(pair(1, pair(2, null)), "test");
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "list(1)",
                  "test list(1, 2)",
                ]
              `)
    })

    test('CHAR_AT works', () => {
      return expectDisplayResult(
        stripIndent`
          display(char_at("test", 1));
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "\\"e\\"",
                ]
              `)
    })

    test('ARITY works', () => {
      return expectDisplayResult(
        stripIndent`
          display(arity(math_random));
          display(arity(accumulate));
          display(arity(display));
          display(arity((x, y) => x));
          function f() {}
          display(arity(f));
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "0",
                  "3",
                  "0",
                  "2",
                  "0",
                ]
              `)
    })

    test('ARITY fails for ill-typed argument', () => {
      return expectParsedError('arity(1);', {
        chapter: Chapter.SOURCE_3,
        variant: Variant.CONCURRENT
      }).toMatchInlineSnapshot(
        `"Error: execution aborted: Expected closure, got number for arity."`
      )
    })

    // variadic test
    test('list works', () => {
      return expectDisplayResult(
        stripIndent`
          display(list(1,2,3,4));
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "[1, [2, [3, [4, null]]]]",
                ]
              `)
    })

    test('stream_tail fails for ill-typed arguments', () => {
      return expectParsedError(
        stripIndent`
        stream_tail(1);
      `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(
        `"Error: \\"stream_tail(xs) expects a pair as argument xs, but encountered 1\\""`
      )
    })
  })

  test('nullary handler', () => {
    return snapshotSuccess('get_time();', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    })
  })

  test('unary handler', () => {
    return expectDisplayResult(
      stripIndent`
          display(math_abs(-1));
        `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "1",
              ]
            `)
  })

  test('binary handler', () => {
    return expectDisplayResult(
      stripIndent`
          display(math_pow(2,3));
        `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "8",
              ]
            `)
  })

  test('math constants', () => {
    return expectDisplayResult(
      stripIndent`
          display(Infinity);
          display(NaN);
        `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "Infinity",
                "NaN",
              ]
            `)
  })

  describe(Variant.CONCURRENT, () => {
    test('TEST_AND_SET works', () => {
      return expectDisplayResult(
        stripIndent`
          const x = list(false);
          display(head(x));
          test_and_set(x);
          display(head(x));
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "false",
                  "true",
                ]
              `)
    })

    test('TEST_AND_SET fails for ill-typed arguments', () => {
      return expectParsedError(
        stripIndent`
        test_and_set(1);
      `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(
        `"Error: execution aborted: Expected array, got number for test_and_set."`
      )
    })

    test('CLEAR works', () => {
      return expectDisplayResult(
        stripIndent`
          const x = list(true);
          display(head(x));
          clear(x);
          display(head(x));
        `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`
                Array [
                  "true",
                  "false",
                ]
              `)
    })

    test('CLEAR fails for ill-typed arguments', () => {
      return expectParsedError(
        stripIndent`
        clear(1);
      `,
        { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
      ).toMatchInlineSnapshot(`"Error: execution aborted: Expected array, got number for clear."`)
    })
  })
})

describe('standard program execution', () => {
  test('program always returns all threads terminated', () => {
    return expectResult('1 + 1;', { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }).toBe(
      'all threads terminated'
    )
  })

  test('arrow function definitions work', () => {
    return expectDisplayResult(
      stripIndent`
        const f = x => {
          display(x);
          return 1;
        };
        const g = x => display(x);
        f(3);
        g(true);
        `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "3",
                "true",
              ]
            `)
  })

  test('logical operators work', () => {
    return expectDisplayResult('display(!(true && (false || (true && !false))));', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              Array [
                "false",
              ]
            `)
  })

  test('&& operator shortcircuit works', () => {
    return snapshotSuccess(
      stripIndent`
        function f() {
          f();
        }
        false && f();
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    )
  })

  test('|| operator shortcircuit works', () => {
    return snapshotSuccess(
      stripIndent`
        function f() {
          f();
        }
        true || f();
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    )
  })

  test('list functions work', () => {
    return expectDisplayResult(
      stripIndent`
        function permutations(xs) {
          return is_null(xs)
                 ? list(null)
                 : accumulate(append,
                              null,
                              map(x => map(p => pair(x, p),
                                           permutations(remove(x,xs))),
                                  xs));
      }

      display(permutations(list(1,2,3)));
    `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "[ [1, [2, [3, null]]],
              [ [1, [3, [2, null]]],
              [ [2, [1, [3, null]]],
              [[2, [3, [1, null]]], [[3, [1, [2, null]]], [[3, [2, [1, null]]], null]]]]]]",
              ]
            `)
  })

  // taken from Studio 11
  test('stream functions work', () => {
    return expectDisplayResult(
      stripIndent`
        function interleave_stream_append(s1,s2) {
          return is_null(s1)
                 ? s2
                 : pair(head(s1), () => interleave_stream_append(s2,
                                          stream_tail(s1)));
        }

        function stream_pairs(s) {
            return (is_null(s) || is_null(stream_tail(s)))
                   ? null
                   : pair(pair(head(s), head(stream_tail(s))),
                          () => interleave_stream_append(
                                    stream_map(x => pair(head(s), x),
                                               stream_tail(stream_tail(s))),
                                stream_pairs(stream_tail(s))));
        }

        const ints = integers_from(1);
        const s = stream_pairs(ints);
        display(eval_stream(s, 10));
        `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "[ [1, 2],
              [ [1, 3],
              [ [2, 3],
              [[1, 4], [[2, 4], [[1, 5], [[3, 4], [[1, 6], [[2, 5], [[1, 7], null]]]]]]]]]]",
              ]
            `)
  })

  test('program times out', () => {
    return expectParsedError('while(true) {}', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`
              "Potential infinite loop detected.
                  If you are certain your program is correct, press run again without editing your program.
                    The time limit will be increased from 1 to 10 seconds.
                    This page may be unresponsive for up to 10 seconds if you do so."
            `)
  })

  test('block scoping works', () => {
    return expectDisplayResult(
      stripIndent`
        const x = 1;
        function f(y) {
          display(-x);
        }
        {
          const x = 2;
          function f(y) {
            display(-x);
          }
          {
            const x = 3;
            if (true) {
              display(x);
            } else {
              error('should not reach here');
            }
            display(x);
            f(1);
          }
          display(x);
        }
        display(x);
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "3",
                "3",
                "-2",
                "2",
                "1",
              ]
            `)
  })

  test('block scoping works, part 2', () => {
    return expectParsedError(
      stripIndent`
        {
          let i = 5;
        }
        display(i);
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`"Line 4: Name i not declared."`)
  })

  test('return in loop throws error', () => {
    return expectParsedError(
      stripIndent`
          function f() {
            while(true) {
              return 1;
            }
          }
          f();
        `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`"Error: return not allowed in loops"`)
  })

  test('continue and break works', () => {
    return expectDisplayResult(
      stripIndent`
        while(true) {
          break;
          display(1);
        }
        let i = 0;
        for (i; i < 2; i = i + 1) {
          if (i === 1) {
            continue;
          } else {
            display(i);
          }
        }
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "0",
              ]
            `)
  })

  test('const assignment throws error', () => {
    return expectParsedError(
      stripIndent`
        const x = 1;
        x = 2;
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`"Line 2: Cannot assign new value to constant x."`)
  })

  test('treat primitive functions as first-class', () => {
    return expectDisplayResult(
      stripIndent`
        const x = list;
        display(x(1,2));
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "[1, [2, null]]",
              ]
            `)
  })

  test('treat internal functions as first-class', () => {
    return expectDisplayResult(
      stripIndent`
        const x = test_and_set;
        const xs = list(false);
        display(x(xs));
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "false",
              ]
            `)
  })

  test('wrong number of arguments for internal functions throws error', () => {
    return expectParsedError(
      stripIndent`
        const x = list(false);
        test_and_set(x, 1);
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`"Error: execution aborted: Expected 1 arguments, but got 2."`)
  })

  test('wrong number of arguments for normal functions throws error', () => {
    return expectParsedError('((x, y) => 1)(1);', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`"Error: execution aborted: Expected 2 arguments, but got 1."`)
  })

  test('wrong number of arguments for primitive functions throws error', () => {
    return expectParsedError('math_sin(1,2);', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`"Error: execution aborted: Expected 1 arguments, but got 2."`)
  })

  test('call non function value throws error', () => {
    return expectParsedError('let x = 0; x(1,2);', {
      chapter: Chapter.SOURCE_3,
      variant: Variant.CONCURRENT
    }).toMatchInlineSnapshot(`"Error: execution aborted: calling non-function value 0."`)
  })

  test('tail call for internal functions work', () => {
    return expectDisplayResult(
      stripIndent`
        function f() {
          return test_and_set(list(true));
        }
        display(f());
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "true",
              ]
            `)
  })

  test('closures declared in for loops work', () => {
    return expectDisplayResult(
      stripIndent`
        let f = null;
        f = () => { display(-1); };
        for(let i = 0; i < 5; i = i + 1) {
          if (i === 3) {
            f = () => { display(i); };
          } else {}
        }
        f();
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "3",
              ]
            `)
  })

  test('nested for loops work', () => {
    return expectDisplayResult(
      stripIndent`
        for (let i = 0; i < 10; i = i + 1) {
          for (let j = 0; j < 10; j = j + 1) {}
          display(i);
        }
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "0",
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8",
                "9",
              ]
            `)
  })

  test('nested for loops with same identifier work', () => {
    return expectDisplayResult(
      stripIndent`
        for (let i = 0; i < 3; i = i + 1) {
          for (let i = 0; i < 3; i = i + 1) {
            display(i, "inner");
          }
          display(i, "outer");
        }
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "inner 0",
                "inner 1",
                "inner 2",
                "outer 0",
                "inner 0",
                "inner 1",
                "inner 2",
                "outer 1",
                "inner 0",
                "inner 1",
                "inner 2",
                "outer 2",
              ]
            `)
  })

  test('continue in while loops works', () => {
    return expectDisplayResult(
      stripIndent`
        let x = false;
        while (true) {
          if (x) {
            break;
          } else {
            x = true;
          }
          continue;
        }
        display(0);
      `,
      { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }
    ).toMatchInlineSnapshot(`
              Array [
                "0",
              ]
            `)
  })
})

// fails with a large enough TO
test('concurrent program execution interleaves', () => {
  const code = stripIndent`
    const t1 = () => {
      for(let i = 0; i < 50; i = i + 1) {
        display('t1');
      }
    };
    const t2 = () => {
      for(let i = 0; i < 50; i = i + 1) {
        display('t2');
      }
    };
    concurrent_execute(t1, t2);
    for(let i = 0; i < 50; i = i + 1) {
      display('main');
    }
  `
  return getDisplayResult(code, { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT }).then(
    displayResult => {
      // check for interleaving displays of main, t1 and t2
      // done by looking for 't1' and 't2' somewhere between two 'main' displays
      let firstMain = -1
      let foundT1 = false
      let foundT2 = false
      for (let i = 0; i < displayResult.length; i++) {
        const currentResult = displayResult[i]
        switch (currentResult) {
          case '"main"': {
            if (firstMain === -1) {
              firstMain = i
              continue
            }
            if (foundT1 && foundT2) {
              return
            }
            continue
          }
          case '"t1"': {
            if (firstMain === -1) {
              continue
            }
            foundT1 = true
            continue
          }
          case '"t2"': {
            if (firstMain === -1) {
              continue
            }
            foundT2 = true
            continue
          }
          default: {
            fail('Did not expect "' + currentResult + '" in output')
          }
        }
      }
      fail('Did not interleave')
    }
  )
})

// Still fails when TO is so large that this program takes more than a second to run
test('concurrent program execution interleaves (busy wait)', () => {
  const code = stripIndent`
    let state = 0;
    const t1 = () => {
      while (state < 10) {
        if (state % 3 === 0) {
          state = state + 1;
        } else {}
        display('t1');
      }
    };
    const t2 = () => {
      while (state < 10) {
        if (state % 3 === 1) {
          state = state + 1;
        } else {}
        display('t2');
      }
    };
    concurrent_execute(t1, t2);
    while (state < 10) {
      if (state % 3 === 2) {
        state = state + 1;
      } else {}
      display('main');
    }
  `
  return getDisplayResult(code, { chapter: Chapter.SOURCE_3, variant: Variant.CONCURRENT })
})
