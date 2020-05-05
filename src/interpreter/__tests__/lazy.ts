import { expectDisplayResult, expectResult } from '../../utils/testing'
import { stripIndent } from '../../utils/formatters'

test('Numeric 5 resolves to 5 on lazy', () => {
  return expectResult(
    stripIndent`
    5;
  `,
    { chapter: 2, variant: 'lazy' }
  ).toBe(5)
})

test('Plain pair works', () => {
  return expectResult(
    stripIndent`
      stringify(pair(1, 2));
    `,
    { chapter: 2, variant: 'lazy' }
  ).toBe('[1, 2]')
})

test('Plain list works', () => {
  return expectResult(
    stripIndent`
      stringify(list(1, 2, 3, 4, 5));
    `,
    { chapter: 2, variant: 'lazy' }
  ).toBe('[1, [2, [3, [4, [5, null]]]]]')
})

test('Infinite list works.', () => {
  return expectResult(
    stripIndent`
    const take = (xs, n) => n === 0 || is_null(xs) ? null : pair(head(xs), take(tail(xs), n - 1));
    const ones = pair(1, ones);
    stringify(take(ones, 5));
  `,
    { chapter: 2, variant: 'lazy' }
  ).toBe('[1, [1, [1, [1, [1, null]]]]]')
})

test('Infinite flip flops', () => {
  return expectResult(
    stripIndent`
    const take = (xs, n) => n === 0 || is_null(xs) ? null : pair(head(xs), take(tail(xs), n - 1));
    const flips = pair(0, flops);
    const flops = pair(1, flips);
    stringify(take(flips, 6));
  `,
    { chapter: 2, variant: 'lazy' }
  ).toBe('[0, [1, [0, [1, [0, [1, null]]]]]]')
})

test('Infinite prime list', () => {
  return expectResult(
    stripIndent`
    const take = (xs, n) => n === 0 || is_null(xs) ? null : pair(head(xs), take(tail(xs), n - 1));
    const sieve = (l) => pair(head(l), sieve(filter((x) => x % head(l) !== 0, l)));
    const nat = (n) => pair(n, nat(n+1));
    const primes = sieve(nat(2));
    stringify(take(primes, 5));
  `,
    { chapter: 2, variant: 'lazy' }
  ).toBe('[2, [3, [5, [7, [11, null]]]]]')
})

test('Ternary true ? 1 : head(null) resolves to 1 on lazy', () => {
  return expectResult(
    stripIndent`
    true ? 1 : head(null);
  `,
    { chapter: 2, variant: 'lazy' }
  ).toBe(1)
})

test('No evaluation of unused variable', () => {
  return expectDisplayResult(
    stripIndent`
      const a = display(1);
      display(2);
    `,
    { chapter: 2, variant: 'lazy' }
  ).toStrictEqual(['2'])
})

test('No evaluation of unused argument', () => {
  return expectDisplayResult(
    stripIndent`
      const f = (a, b) => b + 5;
      const a = display(20);
      f(a, 10);
    `,
    { chapter: 2, variant: 'lazy' }
  ).toStrictEqual([])
})

test('No evaluation of unused argument', () => {
  return expectDisplayResult(
    stripIndent`
      const f = (a, b) => b + 5;
      const a = display(20);
      f(a + 3, 10);
    `,
    { chapter: 2, variant: 'lazy' }
  ).toStrictEqual([])
})

test('Delayed execution of display until required', () => {
  return expectDisplayResult(
    stripIndent`
      const a = display(1);
      const f = (a) => {
        display(2);
        display(a + 3);
      };
      f(a);
    `,
    { chapter: 2, variant: 'lazy' }
  ).toStrictEqual(['2', '1', '4'])
})

test('Delayed evaluation of operation until required', () => {
  return expectDisplayResult(
    stripIndent`
      const a = display(1);
      const f = (a) => {
        display(2);
        display(a + 3);
      };
      f(display(a + 4));
    `,
    { chapter: 2, variant: 'lazy' }
  ).toStrictEqual(['2', '1', '5', '8'])
})

test('Not stuck at resolving unused value', () => {
  return expectResult(
    stripIndent`
      const f = (x) => f(display(x));
      const a = f(0);
      display(2);
    `,
    { chapter: 2, variant: 'lazy' }
  ).toBe(2)
})
