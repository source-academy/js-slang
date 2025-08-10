import { expect, test } from 'vitest';
import { Chapter } from '../types'
import { stripIndent } from '../utils/formatters'
import { testFailure, testSuccess } from '../utils/testing';

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
  `
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
  `
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
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

// This is bad practice. Don't do this!
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
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

// This is bad practice. Don't do this!
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
    { chapter: Chapter.SOURCE_4 }
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
    { chapter: Chapter.SOURCE_4 }
  )).resolves.toMatchInlineSnapshot(`1`)
})

test('Cannot overwrite loop variables within a block', () => {
  return expect(testFailure(
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
  )).resolves.toMatchInlineSnapshot(
    `"Line 4: Assignment to a for loop variable in the for loop is not allowed."`
  )
})

test('No hoisting of functions. Only the name is hoisted like let and const', () => {
  return expect(testFailure(stripIndent`
      const v = f();
      function f() {
        return 1;
      }
      v;
    `)).resolves.toMatchInlineSnapshot(`"Line 1: ReferenceError: Cannot access 'f' before initialization"`)
}, 30000)

test('Error when accessing temporal dead zone', () => {
  return expect(testFailure(stripIndent`
    const a = 1;
    function f() {
      display(a);
      const a = 5;
    }
    f();
    `)).resolves.toMatchInlineSnapshot(`"Line 3: ReferenceError: Cannot access 'a' before initialization"`)
}, 30000)

// tslint:disable-next-line:max-line-length
test('In a block, every going-to-be-defined variable in the block cannot be accessed until it has been defined in the block.', () => {
  return expect(testFailure(stripIndent`
      const a = 1;
      {
        a + a;
        const a = 10;
      }
    `)).resolves.toMatchInlineSnapshot(`"Line 3: ReferenceError: Cannot access 'a' before initialization"`)
}, 30000)

test('Shadowed variables may not be assigned to until declared in the current scope', () => {
  return expect(testFailure(
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
  )).resolves.toMatchInlineSnapshot(
    `"Line 3: ReferenceError: Cannot access 'variable' before initialization"`
  )
})
