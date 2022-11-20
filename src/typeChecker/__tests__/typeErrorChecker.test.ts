import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { parse as __parse, parseAndTypeCheck } from '../../parser/parser'
import { Chapter, Variant } from '../../types'

describe('primitive types', () => {
  it('does not throw errors for allowed primitive types', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: boolean = true;
      const x4: undefined = undefined;
      const x5: any = false;
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('throws errors for disallowed primitive types', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x1: unknown = 1;
      const x2: never = 1;
      const x3: bigint = 1;
      const x4: object = 1;
      const x5: symbol = 1;
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
    "Line 1: Type 'unknown' is not allowed.
    Line 2: Type 'never' is not allowed.
    Line 3: Type 'bigint' is not allowed.
    Line 4: Type 'object' is not allowed.
    Line 5: Type 'symbol' is not allowed."
    `)
  })

  it('throws error for null type only for source 1', () => {
    const source1Context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = 'const x1: null = null;'

    parseAndTypeCheck(code, source1Context)
    expect(parseError(source1Context.errors)).toMatchInlineSnapshot(`
    "Line 1: Type 'null' is not allowed.
    Line 1: null literals are not allowed."
    `)

    // TODO: Add test for Source 2
  })
})

describe('variable declarations', () => {
  it('identifies type mismatch errors for literals correctly', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x1: number = '1';
      const x2: string = true;
      const x3: boolean = undefined;
      const x4: undefined = 1;
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
    "Line 1: Type 'string' is not assignable to type 'number'.
    Line 2: Type 'boolean' is not assignable to type 'string'.
    Line 3: Type 'undefined' is not assignable to type 'boolean'.
    Line 4: Type 'number' is not assignable to type 'undefined'."
    `)
  })

  it('identifies type mismatch errors for identifiers correctly', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x1: number = 1;
      const x2: string = x1;
      const x3: boolean = x1;
      const x4: undefined = x1;
      const x5: number = x1;
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
    "Line 2: Type 'number' is not assignable to type 'string'.
    Line 3: Type 'number' is not assignable to type 'boolean'.
    Line 4: Type 'number' is not assignable to type 'undefined'."
    `)
  })
})
