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
    const code = `const arr1: number[] = [1, 2, 3]; // no error
      const arr2: string[] = ['1', '2', '3']; // no error
      const arr3: number[] = [1, '2', 3]; // no error
      const arr4: boolean[] = [1, '2', 3]; // error
      const arr5: (number | string)[] = [1, '2', 3]; // no error
      const arr6: number[] = []; // no error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 4: Type '(number | string)[]' is not assignable to type 'boolean[]'."`
    )
  })

  it('handles nested array types', () => {
    const code = `const arr1: number[][] = [[1], [2], [3]]; // no error
      const arr2: string[][] = [['1'], ['2'], ['3']]; // no error
      const arr3: number[][] = [[1], ['2'], [3]]; // no error
      const arr4: boolean[][] = [[1], ['2'], [3]]; // error
      const arr5: (number | string)[][] = [[1], ['2'], [3]]; // no error
      const arr6: number[][] = []; // no error
      const arr7: number[][] = [1, 2, 3]; // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 4: Type '(number[] | string[])[]' is not assignable to type 'boolean[][]'.
      Line 7: Type 'number[]' is not assignable to type 'number[][]'."
    `)
  })
})

describe('array access', () => {
  it('index must be success type of number', () => {
    const code = `const arr: number[] = [1, 2, 3];
      const x1: number = 0;
      const x2: string = '1';
      const x3: boolean = true;
      const x4: string | number = '1';
      const x5: string | boolean = '1';
      arr[0]; // no error
      arr['1']; // error
      arr[true]; // error
      arr[x1]; // no error
      arr[x2]; // error
      arr[x3]; // error
      arr[x4]; // no error
      arr[x5]; // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 8: Type '\\"1\\"' cannot be used as an index type.
      Line 9: Type 'true' cannot be used as an index type.
      Line 11: Type 'string' cannot be used as an index type.
      Line 12: Type 'boolean' cannot be used as an index type.
      Line 14: Type 'string | boolean' cannot be used as an index type."
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
  it('predicate must be success type of boolean', () => {
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
      Line 9: Type 'number' is not assignable to type 'boolean'.
      Line 12: Type 'number' is not assignable to type 'boolean'."
    `)
  })
})

describe('for loops', () => {
  it('predicate must be success type of boolean', () => {
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
      Line 7: Type 'number' is not assignable to type 'boolean'.
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

describe('binary operations', () => {
  it('=== and !== allows any type on both sides', () => {
    const code = `const x1: number = 1;
      const x2: string = '1';
      const x3: boolean = true;
      const x4: any = true;
      const x5 = undefined;
      const x6: string | number = 1;
      const x7: string | boolean = '1';
      const x8: boolean = x1 === 1; // number + number
      const x9: boolean = x2 !== '1'; // string + string
      const x10: boolean = x1 === x3; // number + boolean
      const x11: boolean = x3 !== x2; // boolean + string
      const x12: boolean = x1 === x4; // number + any
      const x13: boolean = x5 !== x2; // any + string
      const x14: boolean = x1 === x2; // number + string
      const x15: boolean = x4 !== x5; // any + any
      const x16: boolean = x6 === x4; // string | number + any
      const x17: boolean = x1 !== x6; // number + string | number
      const x18: boolean = x6 === x2; // string | number + string
      const x19: boolean = x5 !== x7; // any + string | boolean
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })
})

describe('stream type', () => {
  it('handles type mismatches correctly', () => {
    const code = `const xs1: Stream<number> = () => pair(1, 2); // error
      const xs2: Stream<number> = () => pair(1, xs2); // no error
      const xs3: Stream<string> = () => pair(1, xs3); // error
      const xs4: Stream<string> = stream(1, 2, 3); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 1: Type '() => Pair<number, number>' is not assignable to type 'Stream<number>'.
      Line 3: Type '() => Pair<number, Stream<string>>' is not assignable to type 'Stream<string>'.
      Line 4: Type '() => Pair<number, Stream<number>>' is not assignable to type 'Stream<string>'."
    `)
  })

  it('type alias with the same name cannot be declared', () => {
    const code = 'type Stream = string;'

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 1: Type alias 'Stream' has already been declared."`
    )
  })
})

describe('stream library functions (select)', () => {
  it('handles types correctly', () => {
    const code = `const xs: Stream<number> = stream(1, 2, 3);
      const ys1: Stream<boolean> = stream_reverse(xs);
      const ys2: Stream<boolean> = stream_map((x: number): string => '1', xs);
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type '() => Pair<number, Stream<number>>' is not assignable to type 'Stream<boolean>'.
      Line 3: Type '() => Pair<string, Stream<string>>' is not assignable to type 'Stream<boolean>'."
    `)
  })
})
