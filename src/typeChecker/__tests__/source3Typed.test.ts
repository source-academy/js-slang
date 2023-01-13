import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter, Variant } from '../../types'

let context = mockContext(Chapter.SOURCE_3, Variant.TYPED)

beforeEach(() => {
  context = mockContext(Chapter.SOURCE_3, Variant.TYPED)
})

describe('array type', () => {
  it('handles type mismatches correctly', () => {
    const code = `const arr1: number[] = [1, 2, 3];
      const arr2: string[] = ['1', '2', '3'];
      const arr3: number[] = [1, '2', 3];
      const arr4: string[] = [1, '2', 3];
      const arr5: (number | string)[] = [1, '2', 3];
      const arr6: number[] = [];
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 3: Type '(number | string)[]' is not assignable to type 'number[]'.
      Line 4: Type '(number | string)[]' is not assignable to type 'string[]'."
    `)
  })

  it('handles nested array types', () => {
    const code = `const arr1: number[][] = [[1], [2], [3]];
      const arr2: string[][] = [['1'], ['2'], ['3']];
      const arr3: number[][] = [[1], ['2'], [3]];
      const arr4: string[][] = [[1], ['2'], [3]];
      const arr5: (number | string)[][] = [[1], ['2'], [3]];
      const arr6: number[][] = [];
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 3: Type '(number[] | string[])[]' is not assignable to type 'number[][]'.
      Line 4: Type '(number[] | string[])[]' is not assignable to type 'string[][]'."
    `)
  })
})

describe('array access', () => {
  it('index must be number', () => {
    const code = `const arr: number[] = [1, 2, 3];
      arr[0];
      arr['1'];
      arr[true];
      arr[undefined];
      arr[null];
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 3: Type '\\"1\\"' cannot be used as an index type.
      Line 4: Type 'true' cannot be used as an index type.
      Line 5: Type 'undefined' cannot be used as an index type.
      Line 6: Type 'null' cannot be used as an index type."
    `)
  })

  it('variable being accessed must be array', () => {
    const code = `const arr: number[] = [1, 2, 3];
      const notArr1: number = 1;
      const notArr2: string = '1';
      const notArr3: boolean = true;
      const notArr4: undefined = undefined;
      const notArr5: null = null;
      arr[0];
      notArr1[0];
      notArr2[0];
      notArr3[0];
      notArr4[0];
      notArr5[0];
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 8: Type 'number' cannot be accessed as it is not an array.
      Line 9: Type 'string' cannot be accessed as it is not an array.
      Line 10: Type 'boolean' cannot be accessed as it is not an array.
      Line 11: Type 'undefined' cannot be accessed as it is not an array.
      Line 12: Type 'null' cannot be accessed as it is not an array."
    `)
  })
})

describe('variable assignment', () => {
  it('handles type mismatches correctly', () => {
    const code = `let x1: number = 1;
      let x2: number | string = 1;
      let x3 = 1;
      x1 = 2;
      x1 = '2';
      x1 = true;
      x2 = 2;
      x2 = '2';
      x2 = true;
      x3 = 2;
      x3 = '2';
      x3 = true;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 5: Type 'string' is not assignable to type 'number'.
      Line 6: Type 'boolean' is not assignable to type 'number'.
      Line 9: Type 'boolean' is not assignable to type 'number | string'."
    `)
  })

  it('cannot assign to const', () => {
    const code = `const x: number = 1;
      x = 2;
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 2: Cannot assign to 'x' as it is a constant."`
    )
  })
})

describe('while loops', () => {
  it('predicate must be boolean', () => {
    const code = `let x: number = 0;
      let y: boolean = true;
      while (x < 1) { // no error
        x = x + 1;
      }
      while (x + 1) { // error
        x = x + 1;
      }
      while (x = 1) { // error
        x = x + 1;
      }
      while (x) { // error
        x = x + 1;
      }
      while (y) { // no error
        x = x + 1;
      }
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 6: Type 'number' is not assignable to type 'boolean'.
      Line 9: Type 'undefined' is not assignable to type 'boolean'.
      Line 12: Type 'number' is not assignable to type 'boolean'."
    `)
  })
})

describe('for loops', () => {
  it('predicate must be boolean', () => {
    const code = `for (let x: number = 0; x < 1; x = x + 1) { // no error
        display(x);
      }
      for (let x: number = 0; x + 1; x = x + 1) { // error
        display(x);
      }
      for (let x: number = 0; x = 1; x = x + 1) { // error
        display(x);
      }
      for (let x: number = 0; x; x = x + 1) { // error
        display(x);
      }
      for (let x: boolean = true; x; x = false) { // no error
        display(x);
      }
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 4: Type 'number' is not assignable to type 'boolean'.
      Line 7: Type 'undefined' is not assignable to type 'boolean'.
      Line 10: Type 'number' is not assignable to type 'boolean'."
    `)
  })

  it('handles scoping', () => {
    const code = `for (let x: number = 0; x > 1; x = x + 1) {
        display(x);
      }
      let x: string = '1';
      for (x = '1'; x === '1'; x = x + '1') {
        display(x);
      }
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })
})
