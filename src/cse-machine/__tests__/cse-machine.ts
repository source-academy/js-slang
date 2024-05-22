import { Chapter, Variant } from '../../types'
import { expectResult, testMultipleCases } from '../../utils/testing/testers'

testMultipleCases<[string, any] | [string, any, Chapter]>([
  [
    'Simple tail call returns work',
    ` 
      function f(x, y) {
        if (x <= 0) {
          return y;
        } else {
          return f(x-1, y+1);
        }
      }
      f(5000, 5000);
    `,
    10000,
  ],
  [
    'Tail call in conditional expressions work',
    `
      function f(x, y) {
        return x <= 0 ? y : f(x-1, y+1);
      }
      f(5000, 5000);
    `,
    10000,
  ],
  [
    'Tail call in boolean operators work',
    `
      function f(x, y) {
        if (x <= 0) {
          return y;
        } else {
          return false || f(x-1, y+1);
        }
      }
      f(5000, 5000);
    `,
    10000,
  ],
  [
    'Tail call in nested mix of conditional expressions and boolean operators',
    `
      function f(x, y) {
        return x <= 0 ? y : false || x > 0 ? f(x-1, y+1) : 'unreachable';
      }
      f(5000, 5000);
    `,
    10000,
  ],
  [
    'Tail calls in arrow functions work',
    `
      const f = (x, y) => x <= 0 ? y : f(x-1, y+1);
      f(5000, 5000);
    `,
    10000,
  ],
  [
    'Tail calls in block arrow functions work',
    `
      const f = (x, y) => {
        if (x <= 0) {
          return y;
        } else {
          return f(x-1, y+1);
        }
      };
      f(5000, 5000);
    `,
    10000,
  ],
  [
    'Tail calls in mutual recursion work',
    `
      function f(x, y) {
        if (x <= 0) {
          return y;
        } else {
          return g(x-1, y+1);
        }
      }
      function g(x, y) {
        if (x <= 0) {
          return y;
        } else {
          return f(x-1, y+1);
        }
      }
      f(5000, 5000);
    `,
    10000,
  ],
  [
    'Tail calls in mutual recursion with arrow functions work',
    `
      const f = (x, y) => x <= 0 ? y : g(x-1, y+1);
      const g = (x, y) => x <= 0 ? y : f(x-1, y+1);
      f(5000, 5000);
    `,
    10000,
  ],
  [
    'Tail calls in mixed tail-call/non-tail-call recursion work',
    `
      function f(x, y, z) {
        if (x <= 0) {
          return y;
        } else {
          return f(x-1, y+f(0, z, 0), z);
        }
      }
      f(5000, 5000, 2);
    `,
    15000,
  ],
  [
    'Standalone block statements',
    `
      function test(){
        const x = true;
        {
            const x = false;
        }
        return x;
      }
      test();
    `,
    true,
  ],
  [
    'const uses block scoping instead of function scoping',
    `
      function test(){
        const x = true;
        if(true) {
            const x = false;
        } else {
            const x = false;
        }
        return x;
      }
      test();
    `,
    true
  ],
  [
    'let uses block scoping instead of function scoping',
      `
        function test(){
        let x = true;
        if(true) {
            let x = false;
        } else {
            let x = false;
        }
        return x;
      }
      test();
    `,
    true,
    Chapter.SOURCE_3
  ],
  [
    'for loops use block scoping instead of function scoping',
    `
      function test() {
        let x = true;
        for (let x = 1; x > 0; x = x - 1) {
        }
        return x;
      }
      test();
    `,
    true,
    Chapter.SOURCE_3
  ],
  [
    'while loops use block scoping instead of function scoping',
    `
      function test(){
        let x = true;
        while (true) {
          let x = false;
          break;
        }
        return x;
      }
      test();
    `,
    true,
    Chapter.SOURCE_4
  ],
  [
    'continue in while loops work as intended',
    `
      function test(){
        let i = 0;
        let j = false;
        while (i <= 10){
          if (i === 10){
            j = true;
            i = i + 1;
            continue;
          }
          j = false;
          i = i + 1;
        }
        return j;
      }
      test();
    `,
    true,
    Chapter.SOURCE_4
  ],
  // see https://www.ecma-international.org/ecma-262/6.0/#sec-for-statement-runtime-semantics-labelledevaluation
  // and https://hacks.mozilla.org/2015/07/es6-in-depth-let-and-const/
  [
    'for loop \'let\' variables are copied into the block scope',
    `
      function test(){
        let z = [];
        for (let x = 0; x < 10; x = x + 1) {
          z[x] = () => x;
        }
        return z[1]();
      }
      test();
    `,
    1,
    Chapter.SOURCE_4
  ],
  [
    'streams and its prelude functions work',
    `
      function make_alternating_stream(stream) {
        return pair(head(stream), () => make_alternating_stream(
                                          negate_whole_stream(
                                              stream_tail(stream))));
      }

      function negate_whole_stream(stream) {
          return pair(-head(stream), () => negate_whole_stream(stream_tail(stream)));
      }

      const ones = pair(1, () => ones);
      list_ref(eval_stream(make_alternating_stream(enum_stream(1, 9)), 9), 8);
    `,
    9,
    Chapter.SOURCE_4
  ],
  [
    'streams can be created and functions with no return statements are still evaluated properly',
    `
      const s = stream(true, false, undefined, 1, x=>x, null, -123, head);
      const result = [];
      stream_for_each(item => {result[array_length(result)] = item;}, s);
      stream_ref(s,4)(22) === 22 && stream_ref(s,7)(pair('', '1')) === '1' && result;
    `,
    false,
    Chapter.SOURCE_4
  ],
  [
    'Conditional statements are value producing always',
    `
      function fact(n) {
        if (n === 0) {
            2;
            return 1;
        }
        if (true) {
            let i = 1;
            i = i - 1;
        } else {
            2;
        }
        if (false) {
            2;
        } else {
            const i = 1;
        }
        return n * fact(n - 1);
        }
      fact(5);
    `,
    120,
    Chapter.SOURCE_3
  ],
  [
    'Nullary functions properly restore environment 1',
    `
      function f() {
        function g(t) {
            return 0;
        }
        return g;
      }
      const h = f();
      h(100);
    `,
    0,
    Chapter.SOURCE_3
  ],
  [
    'Nullary functions properly restore environment 2',
    `
      function f() {
        const a = 1;
        return a;
      }
      const a = f();
      a;
    `,
    1,
    Chapter.SOURCE_3
  ],
  [
    'Array literals work as expected',
    'let c = [1, 2, 3]; c;',
    [1, 2, 3],
    Chapter.SOURCE_3
  ],
  [
    'Array literals are unpacked in the correct order',
    `
      let d = 0;
      let c = [ d = d * 10 + 1, d = d * 10 + 2, d = d * 10 + 3];
      d;
    `,
    123,
    Chapter.SOURCE_3
  ],
  [
    'Breaks, continues and returns are detected properly inside loops',
    `
      function f() {
        let i = 0;
        while(i < 10) {
            i = i + 1;
            if (i === 1) {
              i = 1;
              i = 1;
            } else if (i === 2) {
              i = 2;
              continue;
            } else if (i === 3) {
              i = 3;
              return i;
            } else if (i === 4) {
              i = 4;
              break;
            }
        }
        return i;
      }
      f();
    `,
    3,
    Chapter.SOURCE_3
  ],
  [
    'Environment reset is inserted when only instructions are in control stack',
    'const a = (v => v)(0);',
    undefined,
    Chapter.SOURCE_3
  ],
  [
    'breaks, continues are properly detected in child blocks 1',
    `
      let i = 0;
      for (i = 1; i < 5; i = i + 1) {
          {
              const a = i;
              if (i === 1) {
                  continue;
              }
          }
          
          {
              const a = i;
              if (i === 2) {
                  break;
              }
          }
      }
      i;
    `,
    2,
    Chapter.SOURCE_3
  ],
  [
    'breaks, continues are properly detected in child blocks 2',
    `
      let a = 0;
      for (let i = 1; i < 5; i = i + 1) {
          {
              const x = 0;
              a = i;
              if (i === 1) {
                  continue;
              }
          }
          
          {
              const x = 0;
              a = i;
              if (i === 2) {
                  break;
              }
          }
      }
      a;
    `,
    2,
    Chapter.SOURCE_3
  ]
], ([code, expected, chapter]) => {
  return expectResult(code, { chapter, variant: Variant.EXPLICIT_CONTROL }).toEqual(expected)
})
