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

describe('union types', () => {
  it('handles type mismatches correctly', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: boolean = true;
      const x4: string | number = x1; // no error
      const x5: number | string = x2; // no error
      const x6: string | number = x3; // error
      const x7: number | string = x6; // no error
      const x8: string = x6; // error
      const x9: number = x6; // error
      const x10: number | boolean = x7; // error
      const x11: number | string | boolean = x8; // no error
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 6: Type 'boolean' is not assignable to type 'string | number'.
      Line 8: Type 'string | number' is not assignable to type 'string'.
      Line 9: Type 'string | number' is not assignable to type 'number'.
      Line 10: Type 'number | string' is not assignable to type 'number | boolean'."
    `)
  })

  it('merges duplicate types', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x1: number | string | number = 1;
      const x2: string | number | string = '1';
      const x3: number | number = 1;
      const x4: number | string = x1; // no error
      const x5: number | string = x2; // no error
      const x6: number = x3; // no error
      const x7: string = x1; // error message should not show duplicates
      const x8: number = x2; // error message should not show duplicates
      const x9: string = x3; // error message should not show duplicates
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 7: Type 'number | string' is not assignable to type 'string'.
      Line 8: Type 'string | number' is not assignable to type 'number'.
      Line 9: Type 'number' is not assignable to type 'string'."
    `)
  })
})

describe('function declarations', () => {
  it('checks argument types correctly', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `function sum(a: number, b: number): number {
        return a + b;
      }
      sum(1, 2); // no error
      sum(1, '2'); // error
      sum(true, 2); // error
      sum('1', false); // 2 errors
      sum(1); // error
      sum(1, '2', 3); // 1 error, typecheck on arguments only done if number of arguments is correct
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 5: Type 'string' is not assignable to type 'number'.
      Line 6: Type 'boolean' is not assignable to type 'number'.
      Line 7: Type 'string' is not assignable to type 'number'.
      Line 7: Type 'boolean' is not assignable to type 'number'.
      Line 8: Expected 2 arguments, but got 1.
      Line 9: Expected 2 arguments, but got 3."
    `)
  })

  it('checks return type correctly', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `function f1(n: number): number {
        return n; // no error
      }
      function f2(n: number): string {
        return n; // error
      }
      function f3(n: number): void {
        return n; // error
      }
      function f4(n: number): void {
        n; // do not return, no error
      }
      function f5(n: number): number { // error
        n; // do not return
      }

      const x1: number = f1(1); // no error
      const x2: number = f2(1); // error
      const x3: number = f3(1); // error
      const x4: number = f4(1); // error
      const x5: number = f5(1); // no error
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 5: Type 'number' is not assignable to type 'string'.
      Line 8: Type 'number' is not assignable to type 'void'.
      Line 13: A function whose declared type is neither 'void' nor 'any' must return a value.
      Line 18: Type 'string' is not assignable to type 'number'.
      Line 19: Type 'void' is not assignable to type 'number'.
      Line 20: Type 'void' is not assignable to type 'number'."
    `)
  })

  it('handles recursive functions correctly', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `function f1(n: number): number {
        return n === 1
          ? n
          : n * f1(n - 1);
      }
      function f2(n: string): number {
        return n === 1 // error
          ? 1
          : n * f2(n - 1); // 3 errors, 1 for multiplication, 1 for subtraction, 1 for function argument
      }
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 7: Type 'number' is not assignable to type 'string'.
      Line 9: Type 'string' is not assignable to type 'number'.
      Line 9: Type 'number' is not assignable to type 'string'.
      Line 9: Type 'string' is not assignable to type 'number'."
    `)
  })
})

describe('type aliases', () => {
  it('type alias nodes should be removed from program at end of typechecking', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `type stringOrNumber = string | number;
      const x = 1;
    `

    const program = parseAndTypeCheck(code, context)
    expect(program).toMatchSnapshot() // Should not contain type alias node
  })

  it('should not be used as variables', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `type x = string | number;
      x;
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`"Line 2: Name x not declared."`)
  })

  it('should throw errors for type mismatch', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `type stringOrNumber = string | number;
      const x: stringOrNumber = true;
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 2: Type 'boolean' is not assignable to type 'string | number'."`
    )
  })

  it('should throw errors for undeclared types', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x: x = 1;`

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`"Line 1: Type 'x' not declared."`)
  })

  it('should coexist with variables of the same name', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `type x = string | number;
      const x: x = 1;
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
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

describe('logical expressions', () => {
  it('left type must be boolean or any', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x1: boolean = true;
      const x2: string = 'false';
      const x3: any = true;
      const x4 = 'false';
      x1 && true; // no error
      x1 || true; // no error
      x2 && true; // error
      x2 || true; // error
      x3 && true; // no error
      x4 || true; // no error
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 7: Type 'string' is not assignable to type 'boolean'.
      Line 8: Type 'string' is not assignable to type 'boolean'."
    `)
  })

  it('return type is union of boolean and right type', () => {
    const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

    const code = `const x1: boolean = true;
      const x2: string = 'false';
      const x3: number | string = 1;
      const x4 = false;
      const x5: string = x1 && x1; // error, return type boolean
      const x6: boolean = x1 || x2; // error, return type boolean | string
      const x7: boolean = x1 && x3; // error, return type boolean | number | string
      const x8: boolean = x1 || x4; // no error, return type any
      const x9: string = x1 && x4; // no error, return type any
    `

    parseAndTypeCheck(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 5: Type 'boolean' is not assignable to type 'string'.
      Line 6: Type 'boolean | string' is not assignable to type 'boolean'.
      Line 7: Type 'boolean | number | string' is not assignable to type 'boolean'."
    `)
  })

  describe('scoping', () => {
    it('gets types correct even if accessed before initialization', () => {
      const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

      const code = `const x: number = f(); // error
      function f(): string {
        return g(); // error
      }
      function g(): number {
        return h;
      }
      const y: string = h; // error
      const h: number = 1;
      `

      parseAndTypeCheck(code, context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(`
        "Line 1: Type 'string' is not assignable to type 'number'.
        Line 3: Type 'number' is not assignable to type 'string'.
        Line 8: Type 'number' is not assignable to type 'string'."
      `)
    })

    it('gets types correct for nested constants and functions', () => {
      const context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

      const code = `function f(n: string): string {
        return n;
      }
      const x: number = 1;
      const y: string = '2';
      {
        function f(n: number): number {
          return n;
        }
        const x: string = '1';
        f(x); // error
        const z: string = x + y; // no error
      }
      const z: string = x + y; // error
      `

      parseAndTypeCheck(code, context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(`
        "Line 11: Type 'string' is not assignable to type 'number'.
        Line 14: Type 'string' is not assignable to type 'number'."
      `)
    })
  })
})
