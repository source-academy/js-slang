import { Chapter, Variant } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { expectParsedError, expectParsedErrorNoSnapshot, expectResult } from '../../utils/testing'

test('Check that stack is at most 10k in size', () => {
  return expectParsedErrorNoSnapshot(
    stripIndent`
    function f(x) {
      if (x <= 0) {
        return 0;
      } else {
        return 1 + f(x-1);
      }
    }
    f(10000);
  `,
    { variant: Variant.EXPLICIT_CONTROL }
  ).toEqual(expect.stringMatching(/Maximum call stack size exceeded\n([^f]*f){3}/))
}, 10000)

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
    { variant: Variant.EXPLICIT_CONTROL }
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
    { variant: Variant.EXPLICIT_CONTROL }
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
    { variant: Variant.EXPLICIT_CONTROL }
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
    { variant: Variant.EXPLICIT_CONTROL }
  ).toMatchInlineSnapshot(`10000`)
})

test('Tail calls in arrow functions work', () => {
  return expectResult(
    stripIndent`
    const f = (x, y) => x <= 0 ? y : f(x-1, y+1);
    f(5000, 5000);
  `,
    { variant: Variant.EXPLICIT_CONTROL }
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
    { variant: Variant.EXPLICIT_CONTROL }
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
    { variant: Variant.EXPLICIT_CONTROL }
  ).toMatchInlineSnapshot(`10000`)
})

test('Tail calls in mutual recursion with arrow functions work', () => {
  return expectResult(
    stripIndent`
    const f = (x, y) => x <= 0 ? y : g(x-1, y+1);
    const g = (x, y) => x <= 0 ? y : f(x-1, y+1);
    f(5000, 5000);
  `,
    { variant: Variant.EXPLICIT_CONTROL }
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
    { variant: Variant.EXPLICIT_CONTROL }
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
    { variant: Variant.EXPLICIT_CONTROL }
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
    { variant: Variant.EXPLICIT_CONTROL }
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
    { chapter: Chapter.SOURCE_3, variant: Variant.EXPLICIT_CONTROL }
  ).toMatchInlineSnapshot(`true`)
})

// This is bad practice. Don't do this!
xtest('for loops use block scoping instead of function scoping', () => {
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
    { chapter: Chapter.SOURCE_3, variant: Variant.EXPLICIT_CONTROL }
  ).toMatchInlineSnapshot(`true`)
})

xtest('while loops use block scoping instead of function scoping', () => {
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
    { chapter: Chapter.SOURCE_4, variant: Variant.EXPLICIT_CONTROL }
  ).toMatchInlineSnapshot(`true`)
})

// see https://www.ecma-international.org/ecma-262/6.0/#sec-for-statement-runtime-semantics-labelledevaluation
// and https://hacks.mozilla.org/2015/07/es6-in-depth-let-and-const/
xtest('for loop `let` variables are copied into the block scope', () => {
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
    { chapter: Chapter.SOURCE_4, variant: Variant.EXPLICIT_CONTROL }
  ).toMatchInlineSnapshot(`1`)
})

test('Cannot overwrite loop variables within a block', () => {
  return expectParsedError(
    stripIndent`
  function test(){
      let z = [];
      for (let x = 0; x < 2; x = x + 1) {
        x = 1;
      }
      return false;
  }
  test();
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(
    `"Line 4: Assignment to a for loop variable in the for loop is not allowed."`
  )
})

test('No hoisting of functions. Only the name is hoisted like let and const', () => {
  return expectParsedError(stripIndent`
      const v = f();
      function f() {
        return 1;
      }
      v;
    `).toMatchInlineSnapshot(
    `"Line 1: Name f declared later in current scope but not yet assigned"`
  )
}, 30000)

test('Error when accessing temporal dead zone', () => {
  return expectParsedError(stripIndent`
    const a = 1;
    function f() {
      display(a);
      const a = 5;
    }
    f();
    `).toMatchInlineSnapshot(
    `"Line 3: Name a declared later in current scope but not yet assigned"`
  )
}, 30000)

// tslint:disable-next-line:max-line-length
test('In a block, every going-to-be-defined variable in the block cannot be accessed until it has been defined in the block.', () => {
  return expectParsedError(stripIndent`
      const a = 1;
      {
        a + a;
        const a = 10;
      }
    `).toMatchInlineSnapshot(
    `"Line 3: Name a declared later in current scope but not yet assigned"`
  )
}, 30000)

test('Shadowed variables may not be assigned to until declared in the current scope', () => {
  return expectParsedError(
    stripIndent`
  let variable = 1;
  function test(){
    variable = 100;
    let variable = true;
    return variable;
  }
  test();
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`"Line 3: Name variable not declared."`)
})
