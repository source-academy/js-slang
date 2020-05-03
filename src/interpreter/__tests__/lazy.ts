import { expectResult } from '../../utils/testing'
import { stripIndent } from '../../utils/formatters'
import { Value } from '../../types'

const prelude = stripIndent`
  const take = (xs, n) => n === 0 || is_null(xs) ? null : pair(head(xs), take(tail(xs), n - 1));
`

function expect(code: string, result: Value) {
  return expectResult(
    stripIndent`
      ${prelude}
      ${code}
    `,
    { chapter: 2, variant: 'lazy' }
  ).toBe(result)
}

test('Numeric 5 resolves to 5 on lazy', () => {
  return expect(
    stripIndent`
    5;
  `,
    5
  )
})

test('Ternary true ? 1 : head(null) resolves to 1 on lazy', () => {
  return expect(
    stripIndent`
    true ? 1 : head(null);
  `,
    1
  )
})

test('const ones = pair(1, ones) resolves to an infinite list of ones.', () => {
  return expect(
    stripIndent`
    const ones = pair(1, ones);
    stringify(take(ones, 5));
  `,
    '[1, [1, [1, [1, [1, null]]]]]'
  )
})

test('Infinite flip flops', () => {
  return expect(
    stripIndent`
    const flips = pair(0, flops);
    const flops = pair(1, flips);
    stringify(take(flips, 6));
  `,
    '[0, [1, [0, [1, [0, [1, null]]]]]]'
  )
})

test('Infinite prime list', () => {
  return expect(
    stripIndent`
    const sieve = (l) => pair(head(l), sieve(filter((x) => x % head(l) !== 0, l)));
    const nat = (n) => pair(n, nat(n+1));
    const primes = sieve(nat(2));
    stringify(take(primes, 5));
  `,
    '[2, [3, [5, [7, [11, null]]]]]'
  )
})
