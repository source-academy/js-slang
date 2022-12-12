import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter, Variant } from '../../types'

let context = mockContext(Chapter.SOURCE_2, Variant.TYPED)

beforeEach(() => {
  context = mockContext(Chapter.SOURCE_2, Variant.TYPED)
})

describe('null type', () => {
  it('handles type mismatches correctly', () => {
    const code = `const x1: null = null;
      const x2: null = '1';
      const x3: boolean = null;
      const x4: undefined = null;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type 'string' is not assignable to type 'null'.
      Line 3: Type 'null' is not assignable to type 'boolean'.
      Line 4: Type 'null' is not assignable to type 'undefined'."
    `)
  })
})
