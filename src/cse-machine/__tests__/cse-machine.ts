import { expect, test, vi } from 'vitest'
import { Chapter, Variant  } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { testSuccess } from '../../utils/testing'

// jest.mock('lodash', () => ({
//   ...jest.requireActual('lodash'),
//   memoize: jest.fn(func => func)
// }))

vi.mock(import('../../modules/loader/loaders'))

const optionEC = { variant: Variant.EXPLICIT_CONTROL }
const optionEC3 = { chapter: Chapter.SOURCE_3, variant: Variant.EXPLICIT_CONTROL }
const optionEC4 = { chapter: Chapter.SOURCE_4, variant: Variant.EXPLICIT_CONTROL }

test('Simple tail call returns work', () => {
  return expect(testSuccess(
    stripIndent`
    function f(x, y) {
      if (x <= 0) {
        return y;
      } else {
        return f(x-1, y+1);
      }
    }
    f(5000, 5000);
  `,
    optionEC
  )).resolves.toMatchInlineSnapshot(`10000`)
})

test('Tail call in conditional expressions work', () => {
  return expect(testSuccess(
    stripIndent`
    function f(x, y) {
      return x <= 0 ? y : f(x-1, y+1);
    }
    f(5000, 5000);
  `,
    optionEC
  )).resolves.toMatchInlineSnapshot(`10000`)
})

test('Tail call in boolean operators work', () => {
  return expect(testSuccess(
    stripIndent`
    function f(x, y) {
      if (x <= 0) {
        return y;
      } else {
        return false || f(x-1, y+1);
      }
    }
    f(5000, 5000);
  `,
    optionEC
  )).resolves.toMatchInlineSnapshot(`10000`)
})

test('Tail call in nested mix of conditional expressions boolean operators work', () => {
  return expect(testSuccess(
    stripIndent`
    function f(x, y) {
      return x <= 0 ? y : false || x > 0 ? f(x-1, y+1) : 'unreachable';
    }
    f(5000, 5000);
  `,
    optionEC
  )).resolves.toMatchInlineSnapshot(`10000`)
})

test('Tail calls in arrow functions work', () => {
  return expect(testSuccess(
    stripIndent`
    const f = (x, y) => x <= 0 ? y : f(x-1, y+1);
    f(5000, 5000);
  `,
    optionEC
  )).resolves.toMatchInlineSnapshot(`10000`)
})

test('Tail calls in arrow block functions work', () => {
  return expect(testSuccess(
    stripIndent`
    const f = (x, y) => {
      if (x <= 0) {
        return y;
      } else {
        return f(x-1, y+1);
      }
    };
    f(5000, 5000);
  `,
    optionEC
  )).resolves.toMatchInlineSnapshot(`10000`)
})

test('Tail calls in mutual recursion work', () => {
  return expect(testSuccess(
    stripIndent`
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
    optionEC
  )).resolves.toMatchInlineSnapshot(`10000`)
})

test('Tail calls in mutual recursion with arrow functions work', () => {
  return expect(testSuccess(
    stripIndent`
    const f = (x, y) => x <= 0 ? y : g(x-1, y+1);
    const g = (x, y) => x <= 0 ? y : f(x-1, y+1);
    f(5000, 5000);
  `,
    optionEC
  )).resolves.toMatchInlineSnapshot(`10000`)
})

test('Tail calls in mixed tail-call/non-tail-call recursion work', () => {
  return expect(testSuccess(
    stripIndent`
    function f(x, y, z) {
      if (x <= 0) {
        return y;
      } else {
        return f(x-1, y+f(0, z, 0), z);
      }
    }
    f(5000, 5000, 2);
  `,
    optionEC
  )).resolves.toMatchInlineSnapshot(`15000`)
})

// This is bad practice. Don't do this!
test('standalone block statements', () => {
  return expect(testSuccess(
    stripIndent`
    function test(){
      const x = true;
      {
          const x = false;
      }
      return x;
    }
    test();
  `,
    optionEC
  )).resolves.toMatchInlineSnapshot(`true`)
})

// This is bad practice. Don't do this!
test('const uses block scoping instead of function scoping', () => {
  return expect(testSuccess(
    stripIndent`
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
    optionEC
  )).resolves.toMatchInlineSnapshot(`true`)
})

// This is bad practice. Don't do this!
test('let uses block scoping instead of function scoping', () => {
  return expect(testSuccess(
    stripIndent`
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
    optionEC3
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('for loops use block scoping instead of function scoping', () => {
  return expect(testSuccess(
    stripIndent`
    function test(){
      let x = true;
      for (let x = 1; x > 0; x = x - 1) {
      }
      return x;
    }
    test();
  `,
    optionEC3
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('while loops use block scoping instead of function scoping', () => {
  return expect(testSuccess(
    stripIndent`
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
    optionEC4
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('continue in while loops are working as intended', () => {
  return expect(testSuccess(
    stripIndent`
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
    optionEC4
  )).resolves.toMatchInlineSnapshot(`true`)
})

// see https://www.ecma-international.org/ecma-262/6.0/#sec-for-statement-runtime-semantics-labelledevaluation
// and https://hacks.mozilla.org/2015/07/es6-in-depth-let-and-const/
test('for loop `let` variables are copied into the block scope', () => {
  return expect(testSuccess(
    stripIndent`
    function test(){
      let z = [];
      for (let x = 0; x < 10; x = x + 1) {
        z[x] = () => x;
      }
      return z[1]();
    }
    test();
    `,
    optionEC4
  )).resolves.toMatchInlineSnapshot(`1`)
})

test('streams and its pre-defined/pre-built functions are working as intended', () => {
  return expect(testSuccess(
    stripIndent`
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
    optionEC4
  )).resolves.toMatchInlineSnapshot(`9`)
})

test('streams can be created and functions with no return statements are still evaluated properly', () => {
  return expect(testSuccess(
    stripIndent`
    const s = stream(true, false, undefined, 1, x=>x, null, -123, head);
    const result = [];
    stream_for_each(item => {result[array_length(result)] = item;}, s);
    stream_ref(s,4)(22) === 22 && stream_ref(s,7)(pair('', '1')) === '1' && result;
    `,
    optionEC4
  )).resolves.toMatchInlineSnapshot(`false`)
})

test('Conditional statements are value producing always', () => {
  return expect(testSuccess(
    stripIndent`
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
    optionEC3
  )).resolves.toMatchInlineSnapshot(`120`)
})

test('Nullary functions properly restore environment 1', () => {
  return expect(testSuccess(
    stripIndent`
    function f() {
      function g(t) {
          return 0;
      }
      return g;
    }
    const h = f();
    h(100);
    `,
    optionEC3
  )).resolves.toMatchInlineSnapshot(`0`)
})

test('Nullary functions properly restore environment 2', () => {
  return expect(testSuccess(
    stripIndent`
    function f() {
      const a = 1;
      return a;
    }
    const a = f();
    a;
    `,
    optionEC3
  )).resolves.toMatchInlineSnapshot(`1`)
})

test('Array literals work as expected', () => {
  return expect(testSuccess(
    stripIndent`
    let c = [1, 2, 3];
    c;
    `,
    optionEC3
  )).resolves.toMatchInlineSnapshot(`
    Array [
      1,
      2,
      3,
    ]
  `)
})

test('Array literals are unpacked in the correct order', () => {
  return expect(testSuccess(
    stripIndent`
    let d = 0;
    let c = [ d = d * 10 + 1, d = d * 10 + 2, d = d * 10 + 3];
    d;
    `,
    optionEC3
  )).resolves.toMatchInlineSnapshot(`123`)
})

test('Breaks, continues and returns are detected properly inside loops', () => {
  return expect(testSuccess(
    stripIndent`
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
    optionEC3
  )).resolves.toMatchInlineSnapshot(`3`)
})

test('Environment reset is inserted when only instructions are in control stack', () => {
  return expect(testSuccess(
    stripIndent`
    const a = (v => v)(0);
    `,
    optionEC3
  )).resolves.toMatchInlineSnapshot(`undefined`)
})

test('breaks, continues are properly detected in child blocks 1', () => {
  return expect(testSuccess(
    stripIndent`
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
    optionEC3
  )).resolves.toMatchInlineSnapshot(`2`)
})

test('breaks, continues are properly detected in child blocks 2', () => {
  return expect(testSuccess(
    stripIndent`
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
    optionEC3
  )).resolves.toMatchInlineSnapshot(`2`)
})
