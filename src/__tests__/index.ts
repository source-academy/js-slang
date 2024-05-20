import { Chapter, type Value } from '../types'
import { expectResult } from '../utils/testing'

const toString = (x: Value) => '' + x

test('Arrow function definition returns itself', () => {
  return expectResult('() => 42;').toMatchInlineSnapshot(`[Function]`)
})

test('Builtins hide their implementation when toString', () => {
  return expectResult('toString(pair);', {
    chapter: Chapter.SOURCE_2,
    native: true,
    testBuiltins: { toString }
  }).toMatchInlineSnapshot(`
            "function pair(left, right) {
            	[implementation hidden]
            }"
          `)
})
