import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter, Variant } from '../../types'
import { parseTreeTypesPrelude } from '../parseTreeTypes.prelude'

let context = mockContext(Chapter.SOURCE_4, Variant.TYPED)

beforeEach(() => {
  context = mockContext(Chapter.SOURCE_4, Variant.TYPED)
})

describe('parse tree types', () => {
  it('prelude has no errors', () => {
    // Use Source 3 Typed context just for this test since the types are predeclared in Source 4 Typed
    context = mockContext(Chapter.SOURCE_3, Variant.TYPED)
    parse(parseTreeTypesPrelude, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })
})

describe('parse', () => {
  it('takes in string', () => {
    const code = `const x1 = parse('1;');
      const x2 = parse(1);
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 2: Type 'number' is not assignable to type 'string'."`
    )
  })
})
