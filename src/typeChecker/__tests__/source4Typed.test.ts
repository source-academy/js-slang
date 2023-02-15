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

  it('types parse trees correctly (program)', () => {
    const code = `const x: Program = parse('const x = 1; x;');
      const type: "statement" = head(x);
      const stmts: List<Statement> = tail(x); // error
      const stmts2: List<Statement> = head(tail(x)); // no error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type '\\"sequence\\"' is not assignable to type '\\"statement\\"'.
      Line 3: Type 'Pair<List<Statement>, null>' is not assignable to type 'List<Statement>'."
    `)
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

  it('returns Program | Statement', () => {
    const code = "const x: number = parse('1;');"

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 1: Type 'Program | Statement' is not assignable to type 'number'."`
    )
  })
})
