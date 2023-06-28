import { Node } from 'estree'

import { UnassignedVariable } from '../../errors/errors'
import { decode, encode } from '../../scm-slang/src'
import { dummyExpression } from '../../utils/dummyAstCreator'
import { decodeError, decodeValue } from '../scheme'

describe('Scheme encoder and decoder', () => {
  it('encodes and decodes strings correctly', () => {
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

  it('decodes runtime errors properly', () => {
    const token = `😀`
    const dummyNode: Node = dummyExpression()
    const error = new UnassignedVariable(encode(token), dummyNode)
    expect(decodeError(error).elaborate()).toContain(`😀`)
  })
})
