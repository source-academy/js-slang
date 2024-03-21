import { Node } from 'estree'

import { UnassignedVariable } from '../../../errors/errors'
import { decode, encode } from '../scm-slang/src'
import { cons, set$45$cdr$33$ } from '../scm-slang/src/stdlib/base'
import { dummyExpression } from '../../../utils/dummyAstCreator'
import { decodeError, decodeValue } from '../../../parser/scheme'

describe('Scheme encoder and decoder', () => {
  it('encoder and decoder are proper inverses of one another', () => {
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
    for (const value of values) {
      expect(decode(encode(value))).toEqual(value)
    }
  })

  it('decoder ignores primitives', () => {
    const values = [1, 2, 3, true, false, null]
    for (const value of values) {
      expect(decodeValue(value)).toEqual(value)
    }
  })

  it('decoder works on function toString representation', () => {
    // Dummy function to test
    function $65$() {}
    expect(decodeValue($65$).toString()).toEqual(`function A() { }`)
  })

  it('decoder works on circular lists', () => {
    function $65$() {}
    const pair = cons($65$, 'placeholder')
    set$45$cdr$33$(pair, pair)
    expect(decodeValue(pair).toString()).toEqual(`function A() { },`)
  })

  it('decoder works on pairs', () => {
    // and in doing so, works on pairs, lists, etc...
    function $65$() {}
    const pair = cons($65$, 'placeholder')
    expect(decodeValue(pair).toString()).toEqual(`function A() { },placeholder`)
  })

  it('decoder works on vectors', () => {
    // scheme doesn't support optimisation of circular vectors yet
    function $65$() {}
    const vector = [$65$, 2, 3]
    expect(decodeValue(vector).toString()).toEqual(`function A() { },2,3`)
  })

  it('decodes runtime errors properly', () => {
    const token = `😀`
    const dummyNode: Node = dummyExpression()
    const error = new UnassignedVariable(encode(token), dummyNode)
    expect(decodeError(error).elaborate()).toContain(`😀`)
  })
})
