import { mockContext } from '../../utils/testing/mocks'
import { Variant } from '../../langs'
import { Chapter } from '../../langs'
import { parse } from '../../parser/parser'
import { parseError } from '../../index'

function getContext() {
  const context = mockContext(Chapter.SOURCE_4, Variant.TYPED)
  context.nativeStorage.loadedModules = {
    exampleModule: {}
  }
  context.nativeStorage.loadedModuleTypes = {
    exampleModule: {
      prelude: `
        class Test1 {}
        class Test2 {}
        class Test3 {}
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

  return context
}

function testParseSuccess(code: string) {
  const context = getContext()
  const program = parse(code, context)
  expect(program).not.toBeNull()
}

function testParseError(code: string) {
  const context = getContext()
  parse(code, context)
  return parseError(context.errors)
}

describe('Typed module tests', () => {
  /* VALID CASES */
  describe('Valid cases', () =>
    it.each([
      [
        'should allow correct assignment of a string variable',
        `
        import { x } from 'exampleModule';
        const a: string = x;
      `
      ],
      [
        'should allow correct assignment of a number variable',
        `
        import { y } from 'exampleModule';
        const a: number = y;
      `
      ],
      [
        'should allow correct assignment of a boolean variable',
        `
        import { z } from 'exampleModule';
        const a: boolean = z;
      `
      ],
      [
        'should allow a correct call to function1',
        `
        import { function1, x, y, z } from 'exampleModule';
        const a: number = function1(10, x, z);
      `
      ],
      [
        'should allow a correct call to function2',
        `
        import { function2, x, y, z } from 'exampleModule';
        const a: string = function2(x, y, z);
      `
      ],
      [
        'should allow a correct call to function3',
        `
        import { function3, x, y, z } from 'exampleModule';
        const a: boolean = function3(z, x, y);
      `
      ]
    ])('%s', (_, code) => testParseSuccess(code)))

  /* ERROR CASES */
  describe('Error cases', () => {
    it('should error when assigning a string to a number variable', () => {
      const code = `
        import { x } from 'exampleModule';
        const a: number = x;
      `
      expect(testParseError(code)).toMatchInlineSnapshot(
        `"Line 3: Type 'string' is not assignable to type 'number'."`
      )
    })

    it('should error when assigning a number to a boolean variable', () => {
      const code = `
        import { y } from 'exampleModule';
        const a: boolean = y;
      `
      expect(testParseError(code)).toMatchInlineSnapshot(
        `"Line 3: Type 'number' is not assignable to type 'boolean'."`
      )
    })

    it('should error when assigning a boolean to a string variable', () => {
      const code = `
        import { z } from 'exampleModule';
        const a: string = z;
      `
      expect(testParseError(code)).toMatchInlineSnapshot(
        `"Line 3: Type 'boolean' is not assignable to type 'string'."`
      )
    })

    it('should error when function1 is called with wrong type for its first argument', () => {
      const code = `
        import { function1, x, z } from 'exampleModule';
        const a = function1("wrong", x, z);
      `
      expect(testParseError(code)).toMatchInlineSnapshot(
        `"Line 3: Type 'string' is not assignable to type 'number'."`
      )
    })

    it('should error when function1 is called with wrong type for its second argument', () => {
      const code = `
        import { function1, y, z } from 'exampleModule';
        const a = function1(10, y, z);
      `
      expect(testParseError(code)).toMatchInlineSnapshot(
        `"Line 3: Type 'number' is not assignable to type 'string'."`
      )
    })

    it('should error when function1 is called with wrong type for its third argument', () => {
      const code = `
        import { function1, x, y } from 'exampleModule';
        const a = function1(10, x, "not boolean");
      `
      expect(testParseError(code)).toMatchInlineSnapshot(
        `"Line 3: Type 'string' is not assignable to type 'boolean'."`
      )
    })

    it('should error when function2 is called with a missing argument', () => {
      const code = `
        import { function2, x, y } from 'exampleModule';
        const a = function2(x, y);
      `
      expect(testParseError(code)).toMatchInlineSnapshot(
        `"Line 3: Expected 3 arguments, but got 2."`
      )
    })

    it('should error when function2 is called with an extra argument', () => {
      const code = `
        import { function2, x, y, z } from 'exampleModule';
        const a = function2(x, y, z, x);
      `
      expect(testParseError(code)).toMatchInlineSnapshot(
        `"Line 3: Expected 3 arguments, but got 4."`
      )
    })

    it('should error when functionError returns a wrong type', () => {
      const code = `
        import { functionError } from 'exampleModule';
        const a: string = functionError(10);
      `
      expect(testParseError(code)).toMatchInlineSnapshot(
        `"Line 6: Type 'number' is not assignable to type 'string'."`
      )
    })

    it('should error when assigning a function2 result (string) to a number variable', () => {
      const code = `
        import { function2, x, y, z } from 'exampleModule';
        const a: number = function2(x, y, z);
      `
      expect(testParseError(code)).toMatchInlineSnapshot(
        `"Line 3: Type 'string' is not assignable to type 'number'."`
      )
    })

    it('should error when function3 is called with arguments in the wrong order', () => {
      const code = `
        import { function3, x, y, z } from 'exampleModule';
        const a = function3(x, z, y);
      `
      expect(testParseError(code)).toMatchInlineSnapshot(`
        "Line 3: Type 'string' is not assignable to type 'boolean'.
        Line 3: Type 'boolean' is not assignable to type 'string'."
      `)
    })
  })

  /* TEST CASES FOR THE 'Test1', 'Test2', and 'Test3' VARIABLES */
  describe("Test cases for the 'Test1', 'Test2', and 'Test3' variables", () => {
    it('should allow correct assignment of Test1 to a variable of type Test1', () => {
      const code = `
        import { test1 } from 'exampleModule';
        const a: Test1 = test1;
      `
      testParseSuccess(code)
    })

    it('should allow correct assignment of Test2 to a variable of type Test2', () => {
      const code = `
        import { test2 } from 'exampleModule';
        const a: Test2 = test2;
      `
      testParseSuccess(code)
    })

    it('should allow correct assignment of Test3 to a variable of type Test3', () => {
      const code = `
        import { test3 } from 'exampleModule';
        const a: Test3 = test3;
      `
      testParseSuccess(code)
    })

    it('should error when assigning Test1 to a variable of type string', () => {
      const code = `
        import { test1 } from 'exampleModule';
        const a: string = test1;
      `
      expect(testParseError(code)).toMatchInlineSnapshot(
        `"Line 3: Type 'Test1' is not assignable to type 'string'."`
      )
    })

    it('should error when assigning Test2 to a variable of type number', () => {
      const code = `
        import { test2 } from 'exampleModule';
        const a: number = test2;
      `
      expect(testParseError(code)).toMatchInlineSnapshot(
        `"Line 3: Type 'Test2' is not assignable to type 'number'."`
      )
    })

    it('should error when assigning Test3 to a variable of type boolean', () => {
      const code = `
        import { test3 } from 'exampleModule';
        const a: boolean = test3;
      `
      expect(testParseError(code)).toMatchInlineSnapshot(
        `"Line 3: Type 'Test3' is not assignable to type 'boolean'."`
      )
    })
  })
})
