import { Chapter, Variant } from '../types'
import { stripIndent } from '../utils/formatters'
import { expectResult } from '../utils/testing'

test('Unused arguments are not evaluated', () => {
  return expectResult(
    stripIndent`
    function test(a, b, c, d, e, f) {
      return a;
    }
    const res = test(1, head(null), 1 + '', !1, '' - 1, head(head(null)));
    res;
    `,
    {
      variant: Variant.LAZY,
      chapter: Chapter.SOURCE_2,
      native: true
    }
  ).toBe(1)
})

test('Unary operations force argument', () => {
  return expectResult(
    stripIndent`
    function neg(b) {
      return !b;
    }
    const res = neg(((x) => x)(false));
    res;
    `,
    {
      variant: Variant.LAZY,
      native: true
    }
  ).toBe(true)
})

test('Binary operations force arguments', () => {
  return expectResult(
    stripIndent`
    function add(x, y) {
      return x + y;
    }
    const res = add(((x) => x)(5), ((x) => x + 1)(9));
    res;
    `,
    { variant: Variant.LAZY, native: true }
  ).toBe(15)
})

test('Conditionals force test', () => {
  return expectResult(
    stripIndent`
    function f(a, b) {
      return (a ? true : head(null)) && (!b ? true : head(null));
    }

    const res = f(((b) => b)(true), ((b) => !b)(true));
    res;
    `,
    { variant: Variant.LAZY, chapter: Chapter.SOURCE_2, native: true }
  ).toBe(true)
})

test('Thunks are memoized', () => {
  return expectResult(
    stripIndent`
    let x = 1;

    function incX() {
      x = x + 1;
      return x;
    }

    function square(n) {
      return n * n;
    }

    const res = square(incX());
    res;
    `,
    { variant: Variant.LAZY, chapter: Chapter.SOURCE_3, native: true }
  ).toBe(4)
})

test('Thunks capture local environment', () => {
  return expectResult(
    stripIndent`
    function addSome(x) {
      const y = x + 1;
      return z => y + z;
    }

    const addSome2 = addSome(2);

    const res = addSome2(3);
    res;
    `,
    { variant: Variant.LAZY, native: true }
  ).toBe(6)
})

test('Tail calls work', () => {
  return expectResult(
    stripIndent`
    function test(a, b) {
      return a === 1 ? a : b;
    }

    function test2(a) {
      return test(a, head(null));
    }

    const res = test2(1);
    res;
    `,
    { variant: Variant.LAZY, chapter: Chapter.SOURCE_2, native: true }
  ).toBe(1)
})
