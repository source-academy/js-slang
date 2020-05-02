import { expectResult } from '../../utils/testing'
import { stripIndent } from '../../utils/formatters'

test('Numeric 5 resolves to 5 on lazy', () => {
  return expectResult(
    stripIndent`
    5;
  `,
    { chapter: 2, variant: 'lazy' }
  ).toBe(5)
})

test('Ternary true ? 1 : head(null) resolves to 1 on lazy', () => {
  return expectResult(
    stripIndent`
    true ? 1 : head(null);
  `,
    { chapter: 2, variant: 'lazy' }
  ).toBe(1)
})

test('const ones = pair(1, ones) resolves to an infinite list of ones.', () => {
  return expectResult(
    stripIndent`
    const ones = pair(1, ones);
    stringify(take(ones, 5));
  `,
    { chapter: 2, variant: 'lazy' }
  ).toBe(5)
})

test('lazy flip_flops', () => {
  return expectResult(
    stripIndent`
    const flip_flops = pair(0, flop_flips);
    const flop_flips = pair(1, flip_flops);
    stringify(5);
  `,
    { chapter: 2, variant: 'lazy' }
  ).toBe('5')
})
