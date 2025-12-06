import type { Node } from 'estree'
import { describe, expect, it, test } from 'vitest'

import { UnassignedVariable } from '../../../errors/errors'
import { dummyExpression } from '../../../utils/ast/dummyAstCreator'
import { decodeValue, mapErrorToScheme } from '../scheme-mapper'
import { decode, encode } from '../scm-slang/src'
import { cons, set$45$cdr$33$ } from '../scm-slang/src/stdlib/base'

describe('Scheme encoder and decoder', () => {
  describe('encoder and decoder are proper inverses of one another', () => {
    const values = [
      'hello',
      'hello world',
      'scheme->JavaScript',
      'hello world!!',
      'true',
      'false',
      'null',
      '1',
      '😀'
    ]

    test.each(values)('Testing value %s', value => {
      expect(decode(encode(value))).toEqual(value)
    })
  })

  it('ignores primitives', () => {
    const values = [1, 2, 3, true, false, null]
    for (const value of values) {
      expect(decodeValue(value)).toEqual(value)
    }
  })

  it('works on function toString representation', () => {
    // Dummy function to test
    function $65$() {}
    expect(decodeValue($65$).toString().replace('\n', ''))
      .toMatch(/function A\(\) \{\s*\}/)
  })

  it('works on circular lists', () => {
    function $65$() {}
    const pair = cons($65$, 'placeholder')
    set$45$cdr$33$(pair, pair)
    expect(decodeValue(pair).toString().replace('\n', ''))
      .toMatch(/function A\(\) \{\s*\},/)
  })

  it('works on pairs', () => {
    // and in doing so, works on pairs, lists, etc...
    function $65$() {}
    const pair = cons($65$, 'placeholder')
    expect(decodeValue(pair).toString().replace('\n', ''))
      .toMatch(/function A\(\) \{\s*\},placeholder/)
  })

  it('works on vectors', () => {
    // scheme doesn't support optimisation of circular vectors yet
    function $65$() {}
    const vector = [$65$, 2, 3]
    expect(decodeValue(vector).toString().replace('\n', ''))
      .toMatch(/function A\(\) \{\s*\},2,3/)
  })

  test('runtime errors properly', () => {
    const token = `😀`
    const dummyNode: Node = dummyExpression()
    const error = new UnassignedVariable(encode(token), dummyNode)
    expect(mapErrorToScheme(error).elaborate()).toContain(`😀`)
  })
})
