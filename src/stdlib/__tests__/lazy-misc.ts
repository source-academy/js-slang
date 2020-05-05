import { stripIndent } from '../../utils/formatters'
import { expectResult } from '../../utils/testing'

test('parse_int with valid args is ok, radix 2', () => {
  return expectResult(
    stripIndent`
    parse_int('1100101010101', 2);
  `,
    { chapter: 1, variant: 'lazy' }
  ).toBe(parseInt('1100101010101', 2))
})

test('parse_int with valid args is ok, radix 36', () => {
  return expectResult(
    stripIndent`
    parse_int('uu1', 36);
  `,
    { chapter: 1, variant: 'lazy' }
  ).toBe(parseInt('uu1', 36))
})

test('parse_int with valid args is ok, but invalid str for radix', () => {
  return expectResult(
    stripIndent`
    parse_int('uu1', 2);
  `,
    { chapter: 1, variant: 'lazy' }
  ).toBe(parseInt('uu1', 2))
})
