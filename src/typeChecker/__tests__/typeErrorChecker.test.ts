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

    // TODO: Add test for Source 2 and above
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
      const x3: boolean = x2;
      const x4: undefined = x3;
      const x5: number = x4;
      const x6: number = x5;
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type 'number' is not assignable to type 'string'.
      Line 3: Type 'string' is not assignable to type 'boolean'.
      Line 4: Type 'boolean' is not assignable to type 'undefined'.
      Line 5: Type 'undefined' is not assignable to type 'number'."
    `)
  })
})

describe('unary operations', () => {
  it('! is allowed only for boolean or any type, and returns boolean type', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x1: boolean = true;
      const x2: string = 'false';
      const x3: any = true;
      const x4 = 'false';
      const x5: boolean = !x1; // no error
      const x6: boolean = !x2; // error as x2 is string
      const x7: boolean = !x3; // no error
      const x8: boolean = !x4; // no error
      const x9: number = !true; // error as result of ! operation is boolean
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 6: Type 'string' is not assignable to type 'boolean'.
      Line 9: Type 'boolean' is not assignable to type 'number'."
    `)
  })

  it('- is allowed only for number or any type, and returns number type', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: any = 1;
      const x4 = '1';
      const x5: number = -x1; // no error
      const x6: number = -x2; // error as x2 is string
      const x7: number = -x3; // no error
      const x8: number = -x4; // no error
      const x9: boolean = -1; // error as result of - operation is number
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 6: Type 'string' is not assignable to type 'number'.
      Line 9: Type 'number' is not assignable to type 'boolean'."
    `)
  })
})

describe('binary operations', () => {
  it('-*/% are allowed only for number or any type, and returns number type', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: any = true;
      const x4 = undefined;
      const x5: number = x1 - 1; // no error, number + number
      const x6: number = 2 * x2; // error as x2 is string
      const x7: number = x1 / x3; // no error, number + any
      const x8: number = x2 % x4; // error as x2 is string
      const x9: string = x3 - x4; // error as result of -*/% operation is number
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 6: Type 'string' is not assignable to type 'number'.
      Line 8: Type 'string' is not assignable to type 'number'.
      Line 9: Type 'number' is not assignable to type 'string'."
    `)
  })

  it('+ is allowed only for number, string or any type, and returns appropriate type', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: boolean = true;
      const x4: any = true;
      const x5 = undefined;
      const x6: number = x1 + 1; // no error, number + number, return type number
      const x7: string = x2 + '1'; // no error, string + string, return type string
      const x8: number = x1 + x3; // error, number + boolean, return type number
      const x9: string = x3 + x2; // error, boolean + string, return type string
      const x10: number = x1 + x4; // no error, number + any, return type number
      const x11: string = x5 + x2; // no error, any + string, return type string
      const x12: string = x1 + x2; // error, number + string, return type string
      const x13: string = x4 + x5; // error, any + any, return type number | string
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 8: Type 'boolean' is not assignable to type 'number'.
      Line 9: Type 'boolean' is not assignable to type 'string'.
      Line 12: Type 'string' is not assignable to type 'number'.
      Line 13: Type 'number | string' is not assignable to type 'string'."
    `)
  })

  it('inequality operators are allowed only for number, string or any type, and returns boolean type', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: boolean = true;
      const x4: any = true;
      const x5 = undefined;
      const x6: boolean = x1 === 1; // no error, number + number
      const x7: boolean = x2 !== '1'; // no error, string + string
      const x8: boolean = x1 < x3; // error, number + boolean
      const x9: boolean = x3 <= x2; // error, boolean + string
      const x10: boolean = x1 > x4; // no error, number + any
      const x11: boolean = x5 >= x2; // no error, any + string
      const x12: boolean = x1 === x2; // error, number + string
      const x13: boolean = x4 !== x5; // no error, any + any
      const x14: string = 1 < 2; // error as result of operation is boolean
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 8: Type 'boolean' is not assignable to type 'number'.
      Line 9: Type 'boolean' is not assignable to type 'string'.
      Line 12: Type 'string' is not assignable to type 'number'.
      Line 14: Type 'boolean' is not assignable to type 'string'."
    `)
  })

  // TODO: Test === and !== for Source 3 and above
})
