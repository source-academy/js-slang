import { decodeError, decodeValue } from '../scheme'
import { encode, decode } from '../../scm-slang/src'
import { UnassignedVariable } from '../../errors/errors'
import { Node } from 'estree'
import { dummyExpression } from '../../utils/dummyAstCreator'

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
