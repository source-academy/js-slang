import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter, Variant } from '../../types'

let context = mockContext(Chapter.SOURCE_1, Variant.TYPED)

beforeEach(() => {
  context = mockContext(Chapter.SOURCE_1, Variant.TYPED)
})

describe('basic types', () => {
  it('does not throw errors for allowed basic types', () => {
    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: boolean = true;
      const x4: undefined = undefined;
      const x5: any = false;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('throws errors for disallowed basic types', () => {
    const code = `const x1: unknown = 1;
      const x2: never = 1;
      const x3: bigint = 1;
      const x4: object = 1;
      const x5: symbol = 1;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 1: Type 'unknown' is not allowed.
      Line 2: Type 'never' is not allowed.
      Line 3: Type 'bigint' is not allowed.
      Line 4: Type 'object' is not allowed.
      Line 5: Type 'symbol' is not allowed."
    `)
  })

  it('throws error for non-callable types', () => {
    const code = `const x1: number = 1;
      x1();
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 2: Type 'number' is not callable."`
    )
  })

  it('throws error for null type', () => {
    const code = 'const x1: null = null;'

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 1: Type 'null' is not allowed.
      Line 1: null literals are not allowed."
    `)
  })
})

describe('union types', () => {
  it('handles type mismatches correctly', () => {
    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: boolean = true;
      const x4: string | number = x1; // no error
      const x5: number | string = x2; // no error
      const x6: string | number = x3; // error
      const x7: number | string = x6; // no error
      const x8: string = x4; // no error
      const x9: number = x4; // no error
      const x10: number | boolean = x7; // no error
      const x11: number | string | boolean = x8; // no error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 6: Type 'boolean' is not assignable to type 'string | number'."`
    )
  })

  it('merges duplicate types', () => {
    const code = `const x1: number | string | number = 1;
      const x2: string | number | string = '1';
      const x3: number | number = 1;
      const x4: number | string = x1; // no error
      const x5: number | string = x2; // no error
      const x6: number = x3; // no error
      const x7: boolean = x1; // error message should not show duplicates
      const x8: boolean = x2; // error message should not show duplicates
      const x9: string = x3; // error message should not show duplicates
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 7: Type 'number | string' is not assignable to type 'boolean'.
      Line 8: Type 'string | number' is not assignable to type 'boolean'.
      Line 9: Type 'number' is not assignable to type 'string'."
    `)
  })
})

describe('literal types', () => {
  it('handles type mismatches correctly', () => {
    const code = `const x1: 1 = 1; // no error
      const x2: 2 = 1; // error
      const x3: '1' = '1'; // no error
      const x4: '2' = '1'; // error
      const x5: true = true; // no error
      const x6: false = true; // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type '1' is not assignable to type '2'.
      Line 4: Type '\\"1\\"' is not assignable to type '\\"2\\"'.
      Line 6: Type 'true' is not assignable to type 'false'."
    `)
  })

  it('matches with correct primitive type', () => {
    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: boolean = true;
      const x4: 1 = x1; // no error
      const x5: 1 = x2; // error
      const x6: 1 = x3; // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 5: Type 'string' is not assignable to type '1'.
      Line 6: Type 'boolean' is not assignable to type '1'."
    `)
  })

  it('works with union types and merges with primitive types', () => {
    const code = `const x1: number | 1 = '1'; // error should show type as 'number'
      const x2: string | '1' | 'test' = false; // error should show type as 'string'
      const x3: boolean | false = 1; // error should show type as 'boolean'
      const x4: number | '1' = '2'; // error should show full type
      const x5: string | true | 1 = false; // error should show full type
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 1: Type 'string' is not assignable to type 'number'.
      Line 2: Type 'boolean' is not assignable to type 'string'.
      Line 3: Type 'number' is not assignable to type 'boolean'.
      Line 4: Type '\\"2\\"' is not assignable to type 'number | \\"1\\"'.
      Line 5: Type 'false' is not assignable to type 'string | true | 1'."
    `)
  })
})

describe('function types', () => {
  it('handles type mismatches correctly', () => {
    const code = `const f1: (a: number, b: number) => number = (a, b) => a + b; // no error
      const f2: (a: string, b: string) => string = (c, d) => c + d; // no error even if argument names are different
      const f3: (a: number, b: number) => number = (a: number, b) => a + b; // no error
      const f4: (a: string, b: string) => string = (a, b: string) => a + b; // no error
      const f5: (a: number, b) => number = (a: number, b) => a + b; // no error
      const f6: (a, b: string) => string = (a, b: string) => a + b; // no error
      const f7: (a: number, b: number) => number = (a, b: string) => a + b; // error
      const f8: (a: string, b: string) => string = (a: number, b) => a + b; // error
      const f9: (a: number, b: number) => number = (a, b): string => a; // error
      const f10: (a: string, b: string) => string = (a, b): number => b; // error
      const f11: (a: number, b: number) => number = (a: string) => a; // error
      const f12: (a: string, b: string) => string = (a: number, b, c) => b; // error
      const f13: () => number = () => 1; // no error
      const f14: () => number = (a) => a; // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 7: Type '(any, string) => string' is not assignable to type '(number, number) => number'.
      Line 8: Type '(number, any) => number' is not assignable to type '(string, string) => string'.
      Line 9: Type '(any, any) => string' is not assignable to type '(number, number) => number'.
      Line 10: Type '(any, any) => number' is not assignable to type '(string, string) => string'.
      Line 11: Type '(string) => string' is not assignable to type '(number, number) => number'.
      Line 12: Type '(number, any, any) => any' is not assignable to type '(string, string) => string'.
      Line 14: Type '(any) => any' is not assignable to type '() => number'."
    `)
  })

  it('handles type mismatches correctly with union types', () => {
    const code = `const f1: (a: number | string, b: number | string) => number | string // no error
        = (c: string | number, d: string | number): string | number => c + d; 
      const f2: (a: number | string, b: number | string) => number | string // error
        = (a: boolean, b: boolean): number | string => a && b ? 1 : '1';
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Type '(boolean, boolean) => number | string' is not assignable to type '(number | string, number | string) => number | string'."`
    )
  })

  it('checks argument types correctly', () => {
    const code = `const sum: (a: number, b: number) => number = (a, b) => a + b;
      sum(1, 2); // no error
      sum(1, '2'); // error
      sum(true, 2); // error
      sum('1', false); // 2 errors
      sum(1); // error
      sum(1, '2', 3); // 1 error, typecheck on arguments only done if number of arguments is correct
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 3: Type 'string' is not assignable to type 'number'.
      Line 4: Type 'boolean' is not assignable to type 'number'.
      Line 5: Type 'string' is not assignable to type 'number'.
      Line 5: Type 'boolean' is not assignable to type 'number'.
      Line 6: Expected 2 arguments, but got 1.
      Line 7: Expected 2 arguments, but got 3."
    `)
  })

  it('gets types of higher order functions correct', () => {
    const code = `const make_adder: (x: number) => (y: number) => number = x => y => x + y;
      const x1 = make_adder(1)(2); // no error
      const x2 = make_adder('1')(2); // error
      const x3 = make_adder(1)('2'); // error
      const x4: string = make_adder(1)(2); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 3: Type 'string' is not assignable to type 'number'.
      Line 4: Type 'string' is not assignable to type 'number'.
      Line 5: Type 'number' is not assignable to type 'string'."
    `)
  })
})

describe('function declarations', () => {
  it('checks argument types correctly', () => {
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

    parse(code, context)
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

    parse(code, context)
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

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 7: Type 'number' is not assignable to type 'string'.
      Line 9: Type 'string' is not assignable to type 'number'.
      Line 9: Type 'number' is not assignable to type 'string'.
      Line 9: Type 'string' is not assignable to type 'number'."
    `)
  })

  it('handles higher order functions', () => {
    const code = `function make_adder(x: number): (y: number) => number {
        function sum(y: number): number {
          return x + y;
        }
        return sum;
      }
      const x1 = make_adder(1)(2); // no error
      const x2 = make_adder('1')(2); // error
      const x3 = make_adder(1)('2'); // error
      const x4: string = make_adder(1)(2); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 8: Type 'string' is not assignable to type 'number'.
      Line 9: Type 'string' is not assignable to type 'number'.
      Line 10: Type 'number' is not assignable to type 'string'."
    `)
  })
})

describe('arrow functions', () => {
  it('checks argument types correctly', () => {
    const code = `((a: number, b: number): number => a + b)(1, 2); // no error
      ((a: number, b: number): number => a + b)(1, '2'); // error
      ((a: number, b: number): number => a + b)(true, 2); // error
      ((a: number, b: number): number => a + b)('1', false); // 2 errors
      ((a: number, b: number): number => a + b)(1); // error
      ((a: number, b: number): number => a + b)(1, '2', 3); // 1 error, typecheck on arguments only done if number of arguments is correct
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type 'string' is not assignable to type 'number'.
      Line 3: Type 'boolean' is not assignable to type 'number'.
      Line 4: Type 'string' is not assignable to type 'number'.
      Line 4: Type 'boolean' is not assignable to type 'number'.
      Line 5: Expected 2 arguments, but got 1.
      Line 6: Expected 2 arguments, but got 3."
    `)
  })

  it('checks return type correctly', () => {
    const code = `(n: number): number => n; // no error
      (n: number): string => n; // error
      (n: number): void => n; // error
      (n: number): void => {
        n; // do not return, no error
      };
      (n: number): number => { // error
        n; // do not return
      };
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type 'number' is not assignable to type 'string'.
      Line 3: Type 'number' is not assignable to type 'void'.
      Line 7: A function whose declared type is neither 'void' nor 'any' must return a value."
    `)
  })

  it('gets return type correct both with and without braces', () => {
    const code = `((a: number, b: number): number => a + b)(1, 2); // no error
      ((a: number, b: number): string => a + b)(1, 2); // error
      ((a: string, b: string): number => {
        return a + b; // error
      })('1', '2');
      ((a: string, b: string): string => { 
        return a + b; // no error
      })('1', '2');
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type 'number' is not assignable to type 'string'.
      Line 4: Type 'string' is not assignable to type 'number'."
    `)
  })

  it('gets types of higher order functions correct', () => {
    const code = `const x1 = ((x: number): (y: number) => number => y => x + y)(1)(2); // no error
      const x2 = ((x: number): (y: number) => number => y => x + y)('1')(2); // error
      const x3 = ((x: number): (y: number) => number => y => x + y)(1)('2'); // error
      const x4: string = ((x: number): (y: number) => number => y => x + y)(1)(2); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type 'string' is not assignable to type 'number'.
      Line 3: Type 'string' is not assignable to type 'number'.
      Line 4: Type 'number' is not assignable to type 'string'."
    `)
  })
})

describe('type aliases', () => {
  it('TSTypeAliasDeclaration nodes should be removed from program at end of typechecking', () => {
    const code = `type StringOrNumber = string | number;
      const x = 1;
    `

    const program = parse(code, context)
    expect(program).toMatchSnapshot() // Should not contain TSTypeAliasDeclaration node
  })

  it('should only be used at top level', () => {
    const code = `type x = string;
      {
        type y = number;
      }
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Type alias declarations may only appear at the top level"`
    )
  })

  it('should not be used as variables', () => {
    const code = `type x = string | number;
      x;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`"Line 2: Name x not declared."`)
  })

  it('should throw errors for type mismatch', () => {
    const code = `type StringOrNumber = string | number;
      const x: StringOrNumber = true;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 2: Type 'boolean' is not assignable to type 'StringOrNumber'."`
    )
  })

  it('type alias can be referenced before initialization', () => {
    const code = `const x: TestType = true;
      type StringOrNumber = string | number;
      type TestType = StringOrNumber;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 1: Type 'boolean' is not assignable to type 'TestType'."`
    )
  })

  it('should throw errors for undeclared types', () => {
    const code = `const x: x = 1;`

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`"Line 1: Type 'x' not declared."`)
  })

  it('should throw errors for duplicates', () => {
    const code = `type x = string;
      type x = number;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 2: SyntaxError: Identifier 'x' has already been declared. (2:11)"`
    )
  })

  it('should coexist with variables of the same name', () => {
    const code = `type x = string | number;
      const x: x = 1;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('type alias name cannot be reserved type', () => {
    const code = `type string = number;
      type number = string;
      type boolean = number;
      type undefined = number;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 1: Type alias name cannot be 'string'.
      Line 2: Type alias name cannot be 'number'.
      Line 3: Type alias name cannot be 'boolean'.
      Line 4: Type alias name cannot be 'undefined'."
    `)
  })

  it('should not throw errors for types that are not introduced yet', () => {
    const code = `type Pair = number;
      type List = string;
      type Stream = boolean;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })
})

describe('generic types', () => {
  it('non-generic types should not have type parameters', () => {
    const code = `type NotGeneric = string;
      const x: NotGeneric<string> = '1';
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 2: Type 'NotGeneric' is not generic."`
    )
  })

  it('should throw errors for incorrect number of type arguments', () => {
    const code = `type Union<T, U> = T | U;
      const x1: Union<string> = '1';
      const x2: Union<string, number, boolean> = true;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Generic type 'Union' requires 2 type argument(s).
      Line 3: Generic type 'Union' requires 2 type argument(s)."
    `)
  })

  it('type parameters cannot be reserved types', () => {
    const code = `type Union<string, number, boolean, undefined> = string | number | boolean | undefined;`

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 1: Type parameter name cannot be 'string'.
      Line 1: Type parameter name cannot be 'number'.
      Line 1: Type parameter name cannot be 'boolean'.
      Line 1: Type parameter name cannot be 'undefined'."
    `)
  })

  it('should throw errors for type mismatch', () => {
    const code = `type Union<T, U> = T | U;
      const x1: Union<string, number> = true;
      const x2: Union<string, boolean> = 1;
      const x3: Union<number, boolean> = '1';
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type 'boolean' is not assignable to type 'Union<string, number>'.
      Line 3: Type 'number' is not assignable to type 'Union<string, boolean>'.
      Line 4: Type 'string' is not assignable to type 'Union<number, boolean>'."
    `)
  })

  it('generic type aliases can be referenced before initialization', () => {
    const code = `const x: Union<string, number> = true;
      type Union<T, U> = T | U;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 1: Type 'boolean' is not assignable to type 'Union<string, number>'."`
    )
  })
})

describe('typecasting', () => {
  it('TSAsExpression nodes should be removed from program at end of typechecking', () => {
    const code = `const x1: string | number = 1;
      const x2: string = x1 as string;
    `

    const program = parse(code, context)
    expect(program).toMatchSnapshot() // Should not contain TSAsExpression node
  })

  it('type to cast to must have non-empty intersection with original type', () => {
    const code = `const x1: string | number = 1;
      const x2: string | number = x1 as string | number; // no error
      const x3: string = x1 as string; // no error
      const x4: number = x1 as number; // no error
      const x5: 1 | '1' = x1 as 1 | '1'; // no error
      const x6: boolean = x1 as boolean; // error
      const x7: true = x1 as true; // error
      const x8: string | number | boolean = x1 as string | number | boolean; // no error
      const x9: 1 | 2 | '1' = x5 as 1 | 2 | '1'; // no error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 6: Type 'string | number' cannot be casted to type 'boolean' as the two types do not intersect.
      Line 7: Type 'string | number' cannot be casted to type 'true' as the two types do not intersect."
    `)
  })
})

describe('variable declarations', () => {
  it('identifies type mismatch errors for literals correctly', () => {
    const code = `const x1: number = '1';
      const x2: string = true;
      const x3: boolean = undefined;
      const x4: undefined = 1;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 1: Type 'string' is not assignable to type 'number'.
      Line 2: Type 'boolean' is not assignable to type 'string'.
      Line 3: Type 'undefined' is not assignable to type 'boolean'.
      Line 4: Type 'number' is not assignable to type 'undefined'."
    `)
  })

  it('identifies type mismatch errors for identifiers correctly', () => {
    const code = `const x1: number = 1;
      const x2: string = x1;
      const x3: boolean = x2;
      const x4: undefined = x3;
      const x5: number = x4;
      const x6: number = x5;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type 'number' is not assignable to type 'string'.
      Line 3: Type 'string' is not assignable to type 'boolean'.
      Line 4: Type 'boolean' is not assignable to type 'undefined'.
      Line 5: Type 'undefined' is not assignable to type 'number'."
    `)
  })
})

describe('unary operations', () => {
  it('! is allowed for boolean type, and returns boolean type', () => {
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

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 6: Type 'string' is not assignable to type 'boolean'.
      Line 9: Type 'boolean' is not assignable to type 'number'."
    `)
  })

  it('- is allowed for number type, and returns number type', () => {
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

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 6: Type 'string' is not assignable to type 'number'.
      Line 9: Type 'number' is not assignable to type 'boolean'."
    `)
  })

  it('typeof is allowed for any type, and returns string type', () => {
    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: any = 1;
      const x4 = '1';
      const x5: string = typeof x1; // no error
      const x6: string = typeof x2; // no error
      const x7: string = typeof x3; // no error
      const x8: string = typeof x4; // no error
      const x9: boolean = typeof 1; // error as result of typeof operation is string
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 9: Type 'string' is not assignable to type 'boolean'."`
    )
  })
})

describe('binary operations', () => {
  it('-*/% are allowed for number type, and returns number type', () => {
    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: any = true;
      const x4 = undefined;
      const x5: string | number = 1;
      const x6: number = x1 - 1; // no error, number + number
      const x7: number = 2 * x2; // error, number + string
      const x8: number = x1 / x3; // no error, number + any
      const x9: number = x2 % x4; // error, string + any
      const x10: number = x1 - x5; // no error, number + string | number
      const x11: number = x5 * x3; // no error, string | number + any
      const x12: string = x3 - x4; // error as result of -*/% operation is number
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 7: Type 'string' is not assignable to type 'number'.
      Line 9: Type 'string' is not assignable to type 'number'.
      Line 12: Type 'number' is not assignable to type 'string'."
    `)
  })

  it('+ is allowed for number or string type, and returns appropriate type', () => {
    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: boolean = true;
      const x4: any = true;
      const x5 = undefined;
      const x6: string | number = 1;
      const x7: string | boolean = '1';
      const x8: number = x1 + 1; // no error, number + number, return type number
      const x9: string = x2 + '1'; // no error, string + string, return type string
      const x10: number = x1 + x3; // error, number + boolean, return type number
      const x11: string = x3 + x2; // error, boolean + string, return type string
      const x12: number = x1 + x4; // no error, number + any, return type number
      const x13: string = x5 + x2; // no error, any + string, return type string
      const x14: number = x1 + x2; // error, number + string, return type number (follows left side)
      const x15: string = x4 + x5; // no error, any + any, return type string | number
      const x16: boolean = x6 + x4; // error, string | number + any, return type number | string
      const x17: number = x1 + x6; // no error, number + string | number, return type number
      const x18: string = x6 + x2; // no error, string | number + string, return type string
      const x19: string | number = x5 + x7; // no error, any + string | boolean, return type number | string
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 10: Type 'boolean' is not assignable to type 'number'.
      Line 11: Type 'boolean' is not assignable to type 'string'.
      Line 14: Type 'string' is not assignable to type 'number'.
      Line 16: Type 'number | string' is not assignable to type 'boolean'."
    `)
  })

  it('inequality operators are allowed for number or string type, and returns boolean type', () => {
    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: boolean = true;
      const x4: any = true;
      const x5 = undefined;
      const x6: string | number = 1;
      const x7: string | boolean = '1';
      const x8: boolean = x1 === 1; // no error, number + number
      const x9: boolean = x2 !== '1'; // no error, string + string
      const x10: boolean = x1 < x3; // error, number + boolean
      const x11: boolean = x3 <= x2; // error, boolean + string
      const x12: boolean = x1 > x4; // no error, number + any
      const x13: boolean = x5 >= x2; // no error, any + string
      const x14: boolean = x1 === x2; // error, number + string
      const x15: boolean = x4 !== x5; // no error, any + any
      const x16: boolean = x6 < x4; // no error, string | number + any
      const x17: boolean = x1 <= x6; // no error, number + string | number
      const x18: boolean = x6 > x2; // no error, string | number + string
      const x19: boolean = x5 >= x7; // no error, any + string | boolean
      const x20: string = 1 === 2; // error as result of operation is boolean
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 10: Type 'boolean' is not assignable to type 'number'.
      Line 11: Type 'boolean' is not assignable to type 'string'.
      Line 14: Type 'string' is not assignable to type 'number'.
      Line 20: Type 'boolean' is not assignable to type 'string'."
    `)
  })
})

describe('logical expressions', () => {
  it('left type must be success type of boolean', () => {
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

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 7: Type 'string' is not assignable to type 'boolean'.
      Line 8: Type 'string' is not assignable to type 'boolean'."
    `)
  })

  it('return type is union of boolean and right type', () => {
    const code = `const x1: boolean = true;
      const x2: string = 'false';
      const x3: number | string = 1;
      const x4 = false;
      const x5: string = x1 && x1; // error, return type boolean
      const x6: number = x1 || x2; // error, return type boolean | string
      const x7: undefined = x1 && x3; // error, return type boolean | number | string
      const x8: boolean = x1 || x4; // no error, return type any
      const x9: string = x1 && x4; // no error, return type any
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 5: Type 'boolean' is not assignable to type 'string'.
      Line 6: Type 'boolean | string' is not assignable to type 'number'.
      Line 7: Type 'boolean | number | string' is not assignable to type 'undefined'."
    `)
  })
})

describe('conditional expressions', () => {
  it('predicate type must be success type of boolean', () => {
    const code = `const x1: boolean = true;
      const x2: string = 'false';
      const x3: any = 1;
      function f1(): number {
        return x1 ? 1 : 2; // no error
      }
      function f2(): number {
        return x2 ? 1 : 2; // error
      }
      function f3(): number {
        return x3 ? 1 : 2; // no error
      }
      function f4(): number {
        return x2 + x3 ? 1 : 2; // error
      }
      function f5(): number {
        return x2 === 'false' ? 1 : 2; // no error
      }
      function f6(): number {
        return x1 || x2 ? 1 : 2; // no error
      }
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 8: Type 'string' is not assignable to type 'boolean'.
      Line 14: Type 'string' is not assignable to type 'boolean'."
    `)
  })

  it('return type is union of cons and alt type', () => {
    const code = `const x: string | number = 1;
      function f1(): number {
        return true ? 1 : 2; // no error
      }
      function f2(): number {
        return true ? true : '1'; // error
      }
      function f3(): number | boolean {
        return true ? true : 2; // no error
      }
      function f4(): number | boolean | string {
        return true ? true : x; // no error
      }
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 6: Type 'boolean | string' is not assignable to type 'number'."`
    )
  })
})

describe('if-else statements', () => {
  it('predicate type must be success type of boolean', () => {
    const code = `const x1: boolean = true;
      const x2: string = 'false';
      const x3: any = 1;
      function f1(): number {
        if (x1) { // no error
          return 1;
        } else {
          return 2;
        }
      }
      function f2(): number {
        if (x2) { // error
          return 1;
        } else {
          return 2;
        }
      }
      function f3(): number {
        if (x3) { // no error
          return 1;
        } else {
          return 2;
        }
      }
      function f4(): number {
        if (x2 + x3) { // error
          return 1;
        } else {
          return 2;
        }
      }
      function f5(): number {
        if (x2 === 'false') { // no error
          return 1;
        } else {
          return 2;
        }
      }
      function f6(): number {
        if (x1 || x2) { // no error
          return 1;
        } else {
          return 2;
        }
      }
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 12: Type 'string' is not assignable to type 'boolean'.
      Line 26: Type 'string' is not assignable to type 'boolean'."
    `)
  })

  it('return type is checked one by one', () => {
    const code = `const x: string | number = 1;
      function f1(): number {
        if (true) { // no error
          return 1;
        } else {
          return 2;
        }
      }
      function f2(): number {
        if (true) {
          return 1;
        } else {
          return '2'; // error
        }
      }
      function f3(): number | boolean {
        if (true) { // no error
          return true;
        } else {
          return 2;
        }
      }
      function f4(): number | boolean | string {
        if (true) { // no error
          return true;
        } else {
          return x;
        }
      }
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 13: Type 'string' is not assignable to type 'number'."`
    )
  })
})

describe('import statements', () => {
  it('identifies imports even if accessed before import statement', () => {
    const code = `show(heart);
      import { show, heart } from 'rune';
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('should only be used at top level', () => {
    const code = `import { show } from 'rune';
      {
        import { heart } from 'rune';
      }
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: SyntaxError: 'import' and 'export' may only appear at the top level (3:8)"`
    )
  })

  it('defaults to any for all imports', () => {
    const code = `import { show, heart } from 'rune';
      show(heart);
      heart(show);
      const x1: string = heart;
      const x2: number = show;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })
})

describe('scoping', () => {
  it('gets types correct even if accessed before initialization', () => {
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

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 1: Type 'string' is not assignable to type 'number'.
      Line 3: Type 'number' is not assignable to type 'string'.
      Line 8: Type 'number' is not assignable to type 'string'."
    `)
  })

  it('gets types correct for nested constants and functions', () => {
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
    const z: number = x + y; // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 11: Type 'string' is not assignable to type 'number'.
      Line 14: Type 'string' is not assignable to type 'number'."
    `)
  })
})
