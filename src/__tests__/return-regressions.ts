/**
 * This file contains tests for regressions that TCO may have caused.
 * Please reference Issue #124 (https://github.com/source-academy/js-slang/issues/124)
 */

import { Chapter } from '../types'
import { expectParsedError, expectResult } from '../utils/testing'

// This is bad practice. Don't do this!
test('Calling unreachable results in error', () => {
  return expectParsedError(`
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function f() {
      unreachable();
      return 0;
    }
    f();
  `).toMatchInlineSnapshot(
    `"Line 3: Expected number on right hand side of operation, got boolean."`
  )
})

// This is bad practice. Don't do this!
test('Bare early returns work', () => {
  return expectResult(
    `
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function f() {
      return 1;
      unreachable();
      return 0;
      unreachable();
    }
    f();
  `,
    { native: true }
  ).toMatchInlineSnapshot(`1`)
})

// This is bad practice. Don't do this!
test('Recursive call early returns work', () => {
  return expectResult(
    `
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function id(x) {
      return x;
    }
    function f() {
      return id(1) + id(2);
      unreachable();
      return 0;
      unreachable();
    }
    f();
  `,
    { native: true }
  ).toMatchInlineSnapshot(`3`)
})

// This is bad practice. Don't do this!
test('Tail call early returns work', () => {
  return expectResult(
    `
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function id(x) {
      return x;
    }
    function f() {
      return id(1);
      unreachable();
      return 0;
      unreachable();
    }
    f();
  `,
    { native: true }
  ).toMatchInlineSnapshot(`1`)
})

// This is bad practice. Don't do this!
test('Bare early returns in if statements work', () => {
  return expectResult(
    `
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function f() {
      if (true) {
        return 1;
        unreachable();
      } else {}
      unreachable();
      return 0;
      unreachable();
    }
    f();
  `,
    { native: true }
  ).toMatchInlineSnapshot(`1`)
})

// This is bad practice. Don't do this!
test('Recursive call early returns in if statements work', () => {
  return expectResult(
    `
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function id(x) {
      return x;
    }
    function f() {
      if (true) {
        return id(1) + id(2);
        unreachable();
      } else {}
      unreachable();
      return 0;
      unreachable();
    }
    f();
  `,
    { native: true }
  ).toMatchInlineSnapshot(`3`)
})

// This is bad practice. Don't do this!
test('Tail call early returns in if statements work', () => {
  return expectResult(
    `
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function id(x) {
      return x;
    }
    function f() {
      if (true) {
        return id(1);
        unreachable();
      } else {}
      unreachable();
      return 0;
      unreachable();
    }
    f();
  `,
    { native: true }
  ).toMatchInlineSnapshot(`1`)
})

// This is bad practice. Don't do this!
test('Bare early returns in while loops work', () => {
  return expectResult(
    `
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function f() {
      while (true) {
        return 1;
        unreachable();
      }
      unreachable();
      return 0;
      unreachable();
    }
    f();
  `,
    { chapter: Chapter.SOURCE_3, native: true }
  ).toMatchInlineSnapshot(`1`)
})

// This is bad practice. Don't do this!
test('Recursive call early returns in while loops work', () => {
  return expectResult(
    `
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function id(x) {
      return x;
    }
    function f() {
      while (true) {
        return id(1) + id(2);
        unreachable();
      }
      unreachable();
      return 0;
      unreachable();
    }
    f();
  `,
    { chapter: Chapter.SOURCE_3, native: true }
  ).toMatchInlineSnapshot(`3`)
})

// This is bad practice. Don't do this!
test('Tail call early returns in while loops work', () => {
  return expectResult(
    `
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function id(x) {
      return x;
    }
    function f() {
      while (true) {
        return id(1);
        unreachable();
      }
      unreachable();
      return 0;
      unreachable();
    }
    f();
  `,
    { chapter: Chapter.SOURCE_3, native: true }
  ).toMatchInlineSnapshot(`1`)
})

// This is bad practice. Don't do this!
test('Bare early returns in for loops work', () => {
  return expectResult(
    `
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function f() {
      for (let i = 0; i < 100; i = i + 1) {
        return i+1;
        unreachable();
      }
      unreachable();
      return 0;
      unreachable();
    }
    f();
  `,
    { chapter: Chapter.SOURCE_3, native: true }
  ).toMatchInlineSnapshot(`1`)
})

// This is bad practice. Don't do this!
test('Recursive call early returns in for loops work', () => {
  return expectResult(
    `
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function id(x) {
      return x;
    }
    function f() {
      for (let i = 0; i < 100; i = i + 1) {
        return id(i+1) + id(i+2);
      }
      return 0;
    }
    f();
  `,
    { chapter: Chapter.SOURCE_3, native: true }
  ).toMatchInlineSnapshot(`3`)
})

// This is bad practice. Don't do this!
test('Tail call early returns in for loops work', () => {
  return expectResult(
    `
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function id(x) {
      return x;
    }
    function f() {
      for (let i = 0; i < 100; i = i + 1) {
        return id(i+1);
        unreachable();
      }
      unreachable();
      return 0;
      unreachable();
    }
    f();
  `,
    { chapter: Chapter.SOURCE_3, native: true }
  ).toMatchInlineSnapshot(`1`)
})
