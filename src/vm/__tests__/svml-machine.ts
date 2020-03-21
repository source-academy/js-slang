import {
  expectParsedError,
  expectDisplayResult,
  expectResult,
  getDisplayResult,
  snapshotSuccess
} from '../../utils/testing'
import { stripIndent } from '../../utils/formatters'

// concurrent programs return undefined so use display
// for tests instead
// all tests assumes display works
// comments mention additional opcodes tested by test code
describe('standard opcodes', () => {
  test('LGCI works', () => {
    return expectDisplayResult(`display(123);`, { chapter: 3.4 }).toMatchInlineSnapshot(`
Array [
  "123",
]
`)
  })

  test('LGCF64 works', () => {
    return expectDisplayResult(`display(1.5);`, { chapter: 3.4 }).toMatchInlineSnapshot(`
Array [
  "1.5",
]
`)
  })

  test('LGCB0 works', () => {
    return expectDisplayResult(`display(false);`, { chapter: 3.4 }).toMatchInlineSnapshot(`
Array [
  "false",
]
`)
  })

  test('LGCB1 works', () => {
    return expectDisplayResult(`display(true);`, { chapter: 3.4 }).toMatchInlineSnapshot(`
Array [
  "true",
]
`)
  })

  test('LGCU works', () => {
    return expectDisplayResult(`display(undefined);`, { chapter: 3.4 }).toMatchInlineSnapshot(`
Array [
  "undefined",
]
`)
  })

  test('LGCN works', () => {
    return expectDisplayResult(`display(null);`, { chapter: 3.4 }).toMatchInlineSnapshot(`
Array [
  "null",
]
`)
  })

  test('LGCS works', () => {
    return expectDisplayResult(`display("test string");`, { chapter: 3.4 }).toMatchInlineSnapshot(`
Array [
  "\\"test string\\"",
]
`)
  })

  test('ADDG works for numbers', () => {
    return expectDisplayResult('display(-1+1);', { chapter: 3.4 }).toMatchInlineSnapshot(`
Array [
  "0",
]
`)
  })

  test('ADDG works for strings', () => {
    return expectDisplayResult('display("first"+"second");', { chapter: 3.4 })
      .toMatchInlineSnapshot(`
Array [
  "\\"firstsecond\\"",
]
`)
  })

  test('ADDG fails for ill-typed operands', () => {
    return expectParsedError('1+undefined;', { chapter: 3.4 }).toMatchInlineSnapshot(
      `"Line -1: Error: execution aborted: types of operands do not match"`
    )
  })

  test('SUBG works for numbers', () => {
    return expectDisplayResult('display(123-124);', { chapter: 3.4 }).toMatchInlineSnapshot(`
Array [
  "-1",
]
`)
  })

  test('MULG works for numbers', () => {
    return expectDisplayResult('display(123*2);', { chapter: 3.4 }).toMatchInlineSnapshot(`
Array [
  "246",
]
`)
  })

  test('DIVG works for numbers', () => {
    return expectDisplayResult('display(128/32);', { chapter: 3.4 }).toMatchInlineSnapshot(`
Array [
  "4",
]
`)
  })

  test('DIVG fails for division by 0', () => {
    return expectParsedError('128/0;', { chapter: 3.4 }).toMatchInlineSnapshot(
      `"Line -1: Error: execution aborted: division by 0"`
    )
  })

  test('MODG works for numbers', () => {
    return expectDisplayResult('display(128%31);', { chapter: 3.4 }).toMatchInlineSnapshot(`
Array [
  "4",
]
`)
  })

  test('NOTG works', () => {
    return expectDisplayResult('display(!false);display(!true);', { chapter: 3.4 })
      .toMatchInlineSnapshot(`
Array [
  "true",
  "false",
]
`)
  })

  test('LTG works for numbers', () => {
    return expectDisplayResult('display(5 < 10); display(10 < 5);', { chapter: 3.4 })
      .toMatchInlineSnapshot(`
Array [
  "true",
  "false",
]
`)
  })

  test('LTG works for strings', () => {
    return expectDisplayResult('display("abc" < "bcd"); display("bcd" < "abc");', { chapter: 3.4 })
      .toMatchInlineSnapshot(`
Array [
  "true",
  "false",
]
`)
  })

  test('GTG works for numbers', () => {
    return expectDisplayResult('display(5 > 10); display(10 > 5);', { chapter: 3.4 })
      .toMatchInlineSnapshot(`
Array [
  "false",
  "true",
]
`)
  })

  test('GTG works for strings', () => {
    return expectDisplayResult('display("abc" > "bcd"); display("bcd" > "abc");', { chapter: 3.4 })
      .toMatchInlineSnapshot(`
Array [
  "false",
  "true",
]
`)
  })

  test('LEG works for numbers', () => {
    return expectDisplayResult(
      stripIndent`
        display(5 <= 10);
        display(5 <= 5);
        display(10 <= 5);
        `,
      {
        chapter: 3.4
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
        chapter: 3.4
      }
    ).toMatchInlineSnapshot(`
Array [
  "true",
  "true",
  "false",
]
`)
  })

  test('GEG works for numbers', () => {
    return expectDisplayResult(
      stripIndent`
        display(5 >= 10);
        display(5 >= 5);
        display(10 >= 5);
        `,
      {
        chapter: 3.4
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
        chapter: 3.4
      }
    ).toMatchInlineSnapshot(`
Array [
  "false",
  "true",
  "true",
]
`)
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
        `,
      { chapter: 3.4 }
    ).toMatchInlineSnapshot(`
Array [
  "3",
  "1",
]
`)
  })

  test('STLG and LDLG works', () => {
    return expectDisplayResult(`const x = 1; display(x);`, { chapter: 3.4 }).toMatchInlineSnapshot(`
Array [
  "1",
]
`)
  })

  // NEWA, LDAG, STAG, DUP
  test('array opcodes work', () => {
    return expectDisplayResult(`const x = [1,2]; display(x[1]); display(x[3]);`, { chapter: 3.4 })
      .toMatchInlineSnapshot(`
Array [
  "2",
  "undefined",
]
`)
  })

  test('EQG works', () => {
    return expectDisplayResult(
      stripIndent`
          const x = [1,2];
          const f = () => {};
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
          0 !== "0");
          `,
      { chapter: 3.4 }
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
      { chapter: 3.4 }
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
      { chapter: 3.4 }
    ).toMatchInlineSnapshot(`
Array [
  "\\"did not BRF\\"",
  "\\"BRF\\"",
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
      { chapter: 3.4 }
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
        { chapter: 3.4 }
      ).toMatchInlineSnapshot(`
Array [
  "0",
  "3",
  "101",
  "2",
]
`)
    })

    test('ERROR works', () => {
      return expectParsedError('error(123);', { chapter: 3.4 }).toMatchInlineSnapshot(
        `"Line -1: Error: 123"`
      )
    })

    test('IS_ARRAY works', () => {
      return expectDisplayResult(
        stripIndent`
          display(is_array([1,2]));
          display(is_array(1));
        `,
        {
          chapter: 3.4
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
          chapter: 3.4
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
        { chapter: 3.4 }
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
        { chapter: 3.4 }
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
        { chapter: 3.4 }
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
        { chapter: 3.4 }
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
        { chapter: 3.4 }
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
        { chapter: 3.4 }
      ).toMatchInlineSnapshot(`
Array [
  "5",
]
`)
    })

    // variadic test
    test('list works', () => {
      return expectDisplayResult(
        stripIndent`
          display(list(1,2,3,4));
        `,
        { chapter: 3.4 }
      ).toMatchInlineSnapshot(`
Array [
  "[1, [2, [3, [4, null]]]]",
]
`)
    })
  })

  // skipped nullary handler testing as they do not have deterministic output
  test('unary handler', () => {
    return expectDisplayResult(
      stripIndent`
          display(math_abs(-1));
        `,
      { chapter: 3.4 }
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
      { chapter: 3.4 }
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
      { chapter: 3.4 }
    ).toMatchInlineSnapshot(`
Array [
  "Infinity",
  "NaN",
]
`)
  })

  describe('concurrent', () => {
    test('TEST_AND_SET works', () => {
      return expectDisplayResult(
        stripIndent`
          const x = list(false);
          display(head(x));
          test_and_set(x);
          display(head(x));
        `,
        { chapter: 3.4 }
      ).toMatchInlineSnapshot(`
Array [
  "false",
  "true",
]
`)
    })

    test('CLEAR works', () => {
      return expectDisplayResult(
        stripIndent`
          const x = list(true);
          display(head(x));
          clear(x);
          display(head(x));
        `,
        { chapter: 3.4 }
      ).toMatchInlineSnapshot(`
Array [
  "true",
  "false",
]
`)
    })
  })
})

describe('standard program execution', () => {
  test('program always returns undefined', () => {
    return expectResult('1 + 1;', { chapter: 3.4 }).toBe(undefined)
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
      { chapter: 3.4 }
    ).toMatchInlineSnapshot(`
Array [
  "3",
  "true",
]
`)
  })

  test('logical operators work', () => {
    return expectDisplayResult('display(!(true && (false || (true && !false))));', {
      chapter: 3.4
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
      { chapter: 3.4 }
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
      { chapter: 3.4 }
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
      { chapter: 3.4 }
    ).toMatchInlineSnapshot(`
Array [
  "[ [1, [2, [3, null]]],
[ [1, [3, [2, null]]],
[ [2, [1, [3, null]]],
[[2, [3, [1, null]]], [[3, [1, [2, null]]], [[3, [2, [1, null]]], null]]] ] ] ]",
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
      { chapter: 3.4 }
    ).toMatchInlineSnapshot(`
Array [
  "[ [1, 2],
[ [1, 3],
[ [2, 3],
[[1, 4], [[2, 4], [[1, 5], [[3, 4], [[1, 6], [[2, 5], [[1, 7], null]]]]]]] ] ] ]",
]
`)
  })

  test('program times out', () => {
    return expectParsedError('while(true) {}', { chapter: 3.4 }).toMatchInlineSnapshot(`
"Line -1: Potential infinite loop detected.
    If you are certain your program is correct, press run again without editing your program.
      The time limit will be increased from 1 to 10 seconds.
      This page may be unresponsive for up to 10 seconds if you do so."
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
  return getDisplayResult(code, { chapter: 3.4 }).then(displayResult => {
    // check for interleaving displays of main, t1 and t2
    // done by looking for 't1' and 't2' somewhere between two 'main' displays
    let firstMain = -1
    let foundT1 = false
    let foundT2 = false
    for (let i = 0; i < displayResult.length; i++) {
      const currentResult = displayResult[i]
      switch (currentResult) {
        case 'main': {
          if (firstMain === -1) {
            firstMain = i
            continue
          }
          if (foundT1 && foundT2) {
            return true
          }
          continue
        }
        case 't1': {
          if (firstMain === -1) {
            continue
          }
          foundT1 = true
          continue
        }
        case 't2': {
          if (firstMain === -1) {
            continue
          }
          foundT2 = true
          continue
        }
      }
    }
    return false
  })
})
