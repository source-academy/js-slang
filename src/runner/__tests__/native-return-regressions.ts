/**
 * This file contains tests for regressions that TCO may have caused.
 * Please reference Issue #124 (https://github.com/source-academy/js-slang/issues/124)
 */

import { Chapter } from '../../types'
import { expectParsedError, expectResult, testMultipleCases } from '../../utils/testing/testers'

// TODO Combine with cse-machine return regressions

// This is bad practice. Don't do this!
test('Calling unreachable results in error', () => {
  return expectParsedError(
    `
    function unreachable() {
      return 1 < true; // Will cause an error
    }
    function f() {
      unreachable();
      return 0;
    }
    f();
  `,
  Chapter.SOURCE_1
  ).toMatchInlineSnapshot(`"Line 3: Expected number on right hand side of operation, got boolean."`)
})

testMultipleCases<[string, any] |  [string, any, Chapter]>([
  [
    'Bare early returns work',
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
    1
  ],
  [
    'Recursive call early returns work',
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
    3
  ],
  [
    'Tail call early returns work',
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
    1
  ],

  // if statements
  [
    'Bare early returns in if statements work',
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
    1
  ],
  [
    'Recursive call early returns in if statements work',
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
    3
  ],
  [
    'Taill call early returns in if statements work',
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
    1
  ],

  // while loops
  [
    'Bare early returns in while loops work',
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
    1,
    Chapter.SOURCE_3
  ],
  [
    'Recursive call early returns in while loops work',
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
    3,
    Chapter.SOURCE_3
  ],
  [
    'Tail call returns in while loops work',
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
    1,
    Chapter.SOURCE_3
  ],
  
  // for loops
  [
    'Bare early returns in for loops work',
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
    1,
    Chapter.SOURCE_3
  ],
  [
    'Recursive call early returns in for loops work',
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
    3,
    Chapter.SOURCE_3
  ],
  [
    'Tail call early returns in for loops work',
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
    1,
    Chapter.SOURCE_3
  ]
], ([code, expected, chapter]) => {
  return expectResult(code, chapter ?? Chapter.SOURCE_1).toEqual(expected)
})
