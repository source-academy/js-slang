import { stripIndent } from '../utils/formatters'
import { expectParsedErrorNoSnapshot, expectResult } from '../utils/testing'

test('Check that stack is at most 10k in size', () => {
  return expectParsedErrorNoSnapshot(stripIndent`
    function f(x) {
      if (x <= 0) {
        return 0;
      } else {
        return 1 + f(x-1);
      }
    }
    f(10000);
  `).toEqual(expect.stringMatching(/Maximum call stack size exceeded\n([^f]*f){3}/))
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
    { native: true }
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
    { native: true }
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
    { native: true }
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
    { native: true }
  ).toMatchInlineSnapshot(`10000`)
})

test('Tail calls in arrow functions work', () => {
  return expectResult(
    stripIndent`
    const f = (x, y) => x <= 0 ? y : f(x-1, y+1);
    f(5000, 5000);
  `,
    { native: true }
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
    { native: true }
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
    { native: true }
  ).toMatchInlineSnapshot(`10000`)
})

test('Tail calls in mutual recursion with arrow functions work', () => {
  return expectResult(
    stripIndent`
    const f = (x, y) => x <= 0 ? y : g(x-1, y+1);
    const g = (x, y) => x <= 0 ? y : f(x-1, y+1);
    f(5000, 5000);
  `,
    { native: true }
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
    { native: true }
  ).toMatchInlineSnapshot(`15000`)
})
