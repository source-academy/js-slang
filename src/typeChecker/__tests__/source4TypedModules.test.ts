import { mockContext } from '../../mocks/context'
import { Chapter, Variant } from '../../types'
import { parse } from '../../parser/parser'
import { parseError } from '../../index'

let context = mockContext(Chapter.SOURCE_4, Variant.TYPED)

beforeEach(() => {
  context = mockContext(Chapter.SOURCE_4, Variant.TYPED)
  context.nativeStorage.loadedModules = {
    exampleModule: {}
  }
  context.nativeStorage.loadedModuleTypes = {
    exampleModule: {
      prelude: `
        class Test1 {}
        class Test2 {}
        class Test3 {}
        type Test4 = (arg: Test1) => Test2;
        const Test4 = (arg: Test1) => Test2;
      `,
      x: 'const x: string = "hello"',
      y: 'const y: number = 42',
      z: 'const z: boolean = true',
      test1: 'const test1: Test1 = Test1',
      test2: 'const test2: Test2 = Test2',
      test3: 'const test3: Test3 = Test3',
      function1: 'function function1(n: number, s: string, b: boolean): number { return n }',
      function2: 'function function2(s: string, n: number, b: boolean): string { return s }',
      function3: 'function function3(b: boolean, s: string, n: number): boolean { return b }',
      functionError: 'function functionError(n: number): string { return n }'
    }
  }
})

describe('Typed module tests', () => {
  /* VALID CASES */

  it('should allow correct assignment of a string variable', () => {
    const code = `
      import { x } from 'exampleModule';
      const a: string = x;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('should allow correct assignment of a number variable', () => {
    const code = `
      import { y } from 'exampleModule';
      const a: number = y;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('should allow correct assignment of a boolean variable', () => {
    const code = `
      import { z } from 'exampleModule';
      const a: boolean = z;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('should allow a correct call to function1', () => {
    const code = `
      import { function1, x, y, z } from 'exampleModule';
      const a: number = function1(10, x, z);
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('should allow a correct call to function2', () => {
    const code = `
      import { function2, x, y, z } from 'exampleModule';
      const a: string = function2(x, y, z);
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('should allow a correct call to function3', () => {
    const code = `
      import { function3, x, y, z } from 'exampleModule';
      const a: boolean = function3(z, x, y);
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  /* ERROR CASES */

  it('should error when assigning a string to a number variable', () => {
    const code = `
      import { x } from 'exampleModule';
      const a: number = x;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Type 'string' is not assignable to type 'number'."`
    )
  })

  it('should error when assigning a number to a boolean variable', () => {
    const code = `
      import { y } from 'exampleModule';
      const a: boolean = y;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Type 'number' is not assignable to type 'boolean'."`
    )
  })

  it('should error when assigning a boolean to a string variable', () => {
    const code = `
      import { z } from 'exampleModule';
      const a: string = z;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Type 'boolean' is not assignable to type 'string'."`
    )
  })

  it('should error when function1 is called with wrong type for its first argument', () => {
    const code = `
      import { function1, x, z } from 'exampleModule';
      const a = function1("wrong", x, z);
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Type 'string' is not assignable to type 'number'."`
    )
  })

  it('should error when function1 is called with wrong type for its second argument', () => {
    const code = `
      import { function1, y, z } from 'exampleModule';
      const a = function1(10, y, z);
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Type 'number' is not assignable to type 'string'."`
    )
  })

  it('should error when function1 is called with wrong type for its third argument', () => {
    const code = `
      import { function1, x, y } from 'exampleModule';
      const a = function1(10, x, "not boolean");
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Type 'string' is not assignable to type 'boolean'."`
    )
  })

  it('should error when function2 is called with a missing argument', () => {
    const code = `
      import { function2, x, y } from 'exampleModule';
      const a = function2(x, y);
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Expected 3 arguments, but got 2."`
    )
  })

  it('should error when function2 is called with an extra argument', () => {
    const code = `
      import { function2, x, y, z } from 'exampleModule';
      const a = function2(x, y, z, x);
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Expected 3 arguments, but got 4."`
    )
  })

  it('should error when functionError returns a wrong type', () => {
    const code = `
      import { functionError } from 'exampleModule';
      const a: string = functionError(10);
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 6: Type 'number' is not assignable to type 'string'."`
    )
  })

  it('should error on variable redeclaration with different types', () => {
    const code = `
      const a: number = 10;
      const a: string = "oops";
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: SyntaxError: Identifier 'a' has already been declared (3:12)"`
    )
  })

  it('should error when assigning a function2 result (string) to a number variable', () => {
    const code = `
      import { function2, x, y, z } from 'exampleModule';
      const a: number = function2(x, y, z);
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Type 'string' is not assignable to type 'number'."`
    )
  })

  it('should error when function3 is called with arguments in the wrong order', () => {
    const code = `
      import { function3, x, y, z } from 'exampleModule';
      const a = function3(x, z, y);
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 3: Type 'string' is not assignable to type 'boolean'.
      Line 3: Type 'boolean' is not assignable to type 'string'."
    `)
  })

  /* TEST CASES FOR THE 'Test1', 'Test2', and 'Test3' VARIABLES */

  it('should allow correct assignment of Test1 to a variable of type Test1', () => {
    const code = `
      import { test1 } from 'exampleModule';
      const a: Test1 = test1;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('should allow correct assignment of Test2 to a variable of type Test2', () => {
    const code = `
      import { test2 } from 'exampleModule';
      const a: Test2 = test2;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('should allow correct assignment of Test3 to a variable of type Test3', () => {
    const code = `
      import { test3 } from 'exampleModule';
      const a: Test3 = test3;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('should error when assigning Test1 to a variable of type string', () => {
    const code = `
      import { test1 } from 'exampleModule';
      const a: string = test1;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Type 'Test1' is not assignable to type 'string'."`
    )
  })

  it('should error when assigning Test2 to a variable of type number', () => {
    const code = `
      import { test2 } from 'exampleModule';
      const a: number = test2;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Type 'Test2' is not assignable to type 'number'."`
    )
  })

  it('should error when assigning Test3 to a variable of type boolean', () => {
    const code = `
      import { test3 } from 'exampleModule';
      const a: boolean = test3;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Type 'Test3' is not assignable to type 'boolean'."`
    )
  })

  /* TEST CASES FOR THE 'Test4' TYPE */
  it('should allow calling Test4 with a valid Test1 object', () => {
    const code = `
      import { test2 } from 'exampleModule';
      const result: Test4 = (arg: Test1) => test2;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('should error when calling Test4 with a string argument', () => {
    const code = `
      import { test1 } from 'exampleModule';
      const result: Test4 = (arg: Test1) => test1;
    `
    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 3: Type '(Test1) => Test1' is not assignable to type 'Test4'."`
    )
  })
})
