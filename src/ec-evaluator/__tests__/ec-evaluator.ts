import { Chapter, Variant } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { expectResult } from '../../utils/testing'

// jest.mock('lodash', () => ({
//   ...jest.requireActual('lodash'),
//   memoize: jest.fn(func => func)
// }))

const mockXMLHttpRequest = (xhr: Partial<XMLHttpRequest> = {}) => {
  const xhrMock: Partial<XMLHttpRequest> = {
    open: jest.fn(() => {}),
    send: jest.fn(() => {}),
    status: 200,
    responseText: 'Hello World!',
    ...xhr
  }
  jest.spyOn(window, 'XMLHttpRequest').mockImplementationOnce(() => xhrMock as XMLHttpRequest)
  return xhrMock
}

const optionEC = { variant: Variant.EXPLICIT_CONTROL }
const optionEC3 = { chapter: Chapter.SOURCE_3, variant: Variant.EXPLICIT_CONTROL }
const optionEC4 = { chapter: Chapter.SOURCE_4, variant: Variant.EXPLICIT_CONTROL }

test('Simple tail call returns work', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`10000`)
})

test('Tail call in conditional expressions work', () => {
  return expectResult(
    stripIndent`
    function f(x, y) {
      return x <= 0 ? y : f(x-1, y+1);
    }
    f(5000, 5000);
  `,
    optionEC
  ).toMatchInlineSnapshot(`10000`)
})

test('Tail call in boolean operators work', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`10000`)
})

test('Tail call in nested mix of conditional expressions boolean operators work', () => {
  return expectResult(
    stripIndent`
    function f(x, y) {
      return x <= 0 ? y : false || x > 0 ? f(x-1, y+1) : 'unreachable';
    }
    f(5000, 5000);
  `,
    optionEC
  ).toMatchInlineSnapshot(`10000`)
})

test('Tail calls in arrow functions work', () => {
  return expectResult(
    stripIndent`
    const f = (x, y) => x <= 0 ? y : f(x-1, y+1);
    f(5000, 5000);
  `,
    optionEC
  ).toMatchInlineSnapshot(`10000`)
})

test('Tail calls in arrow block functions work', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`10000`)
})

test('Tail calls in mutual recursion work', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`10000`)
})

test('Tail calls in mutual recursion with arrow functions work', () => {
  return expectResult(
    stripIndent`
    const f = (x, y) => x <= 0 ? y : g(x-1, y+1);
    const g = (x, y) => x <= 0 ? y : f(x-1, y+1);
    f(5000, 5000);
  `,
    optionEC
  ).toMatchInlineSnapshot(`10000`)
})

test('Tail calls in mixed tail-call/non-tail-call recursion work', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`15000`)
})

// This is bad practice. Don't do this!
test('standalone block statements', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`true`)
})

// This is bad practice. Don't do this!
test('const uses block scoping instead of function scoping', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`true`)
})

// This is bad practice. Don't do this!
test('let uses block scoping instead of function scoping', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`true`)
})

test('for loops use block scoping instead of function scoping', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`true`)
})

test('while loops use block scoping instead of function scoping', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`true`)
})

test('continue in while loops are working as intended', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`true`)
})

// see https://www.ecma-international.org/ecma-262/6.0/#sec-for-statement-runtime-semantics-labelledevaluation
// and https://hacks.mozilla.org/2015/07/es6-in-depth-let-and-const/
test('for loop `let` variables are copied into the block scope', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`1`)
})

test('streams and its pre-defined/pre-built functions are working as intended', () => {
  return expectResult(
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
  ).toMatchInlineSnapshot(`9`)
})

test('streams can be created and functions with no return statements are still evaluated properly', () => {
  return expectResult(
    stripIndent`
    const s = stream(true, false, undefined, 1, x=>x, null, -123, head);
    const result = [];
    stream_for_each(item => {result[array_length(result)] = item;}, s);
    stream_ref(s,4)(22) === 22 && stream_ref(s,7)(pair('', '1')) === '1' && result;
    `,
    optionEC4
  ).toMatchInlineSnapshot(`false`)
})

test('Imports are properly handled', () => {
  // for getModuleFile
  mockXMLHttpRequest({
    responseText: `{
    "one_module": {
      "tabs": []
    },
    "another_module": {
      "tabs": []
    }
  }`
  })

  // for bundle body
  mockXMLHttpRequest({
    responseText: `
      require => {
        return {
          foo: () => 'foo',
        }
      }
    `
  })

  return expectResult(
    stripIndent`
    import { foo } from 'one_module';
    foo();
  `,
    optionEC
  ).toEqual('foo')
})
