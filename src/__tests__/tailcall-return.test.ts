import { test } from 'vitest'
import { stripIndent } from '../utils/formatters'
import { expectParsedError, expectFinishedResult } from '../utils/testing'

test('Check that stack is at most 10k in size', () => {
  return expectParsedError(stripIndent`
    function f(x) {
      if (x <= 0) {
        return 0;
      } else {
        return 1 + f(x-1);
      }
    }
    f(10000);
  `).toEqual('Line 5: RangeError: Maximum call stack size exceeded')
}, 10000)

test('Simple tail call returns work', () => {
  return expectFinishedResult(
    stripIndent`
    function f(x, y) {
      if (x <= 0) {
        return y;
      } else {
        return f(x-1, y+1);
      }
    }
    f(5000, 5000);
  `
  ).toEqual(10000)
})

test('Tail call in conditional expressions work', () => {
  return expectFinishedResult(
    stripIndent`
    function f(x, y) {
      return x <= 0 ? y : f(x-1, y+1);
    }
    f(5000, 5000);
  `
  ).toEqual(10000)
})

test('Tail call in boolean operators work', () => {
  return expectFinishedResult(
    stripIndent`
    function f(x, y) {
      if (x <= 0) {
        return y;
      } else {
        return false || f(x-1, y+1);
      }
    }
    f(5000, 5000);
  `
  ).toEqual(10000)
})

test('Tail call in nested mix of conditional expressions boolean operators work', () => {
  return expectFinishedResult(
    stripIndent`
    function f(x, y) {
      return x <= 0 ? y : false || x > 0 ? f(x-1, y+1) : 'unreachable';
    }
    f(5000, 5000);
  `
  ).toEqual(10000)
})

test('Tail calls in arrow functions work', () => {
  return expectFinishedResult(
    stripIndent`
    const f = (x, y) => x <= 0 ? y : f(x-1, y+1);
    f(5000, 5000);
  `
  ).toEqual(10000)
})

test('Tail calls in arrow block functions work', () => {
  return expectFinishedResult(
    stripIndent`
    const f = (x, y) => {
      if (x <= 0) {
        return y;
      } else {
        return f(x-1, y+1);
      }
    };
    f(5000, 5000);
  `
  ).toEqual(10000)
})

test('Tail calls in mutual recursion work', () => {
  return expectFinishedResult(
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
  `
  ).toEqual(10000)
})

test('Tail calls in mutual recursion with arrow functions work', () => {
  return expectFinishedResult(
    stripIndent`
    const f = (x, y) => x <= 0 ? y : g(x-1, y+1);
    const g = (x, y) => x <= 0 ? y : f(x-1, y+1);
    f(5000, 5000);
  `
  ).toEqual(10000)
})

test('Tail calls in mixed tail-call/non-tail-call recursion work', () => {
  return expectFinishedResult(
    stripIndent`
    function f(x, y, z) {
      if (x <= 0) {
        return y;
      } else {
        return f(x-1, y+f(0, z, 0), z);
      }
    }
    f(5000, 5000, 2);
  `
  ).toEqual(15000)
})
