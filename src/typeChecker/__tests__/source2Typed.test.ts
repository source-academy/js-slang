import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter, Variant } from '../../types'

let context = mockContext(Chapter.SOURCE_2, Variant.TYPED)

beforeEach(() => {
  context = mockContext(Chapter.SOURCE_2, Variant.TYPED)
})

describe('null type', () => {
  it('handles type mismatches correctly', () => {
    const code = `const x1: null = null; // no error
      const x2: null = '1'; // error
      const x3: boolean = null; // error
      const x4: undefined = null; // error
      const x5: null = list(); // no error as null is empty list
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type 'string' is not assignable to type 'null'.
      Line 3: Type 'null' is not assignable to type 'boolean'.
      Line 4: Type 'null' is not assignable to type 'undefined'."
    `)
  })
})

describe('pair', () => {
  it('handles type mismatches correctly', () => {
    const code = `const x1: Pair<number, number> = pair(1, 2); // no error
      const x2: Pair<number, number> = pair(1, '2'); // error
      const x3: Pair<number, number> = 1; // error
      const x4: Pair<number> = pair(1, 2); // error
      const x5: Pair<number, number> = list(1, 2); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 4: Generic type 'Pair' requires 2 type argument(s).
      Line 2: Type 'Pair<number, string>' is not assignable to type 'Pair<number, number>'.
      Line 3: Type 'number' is not assignable to type 'Pair<number, number>'.
      Line 5: Type 'List<number>' is not assignable to type 'Pair<number, number>'."
    `)
  })

  it('pair() must take in 2 arguments', () => {
    const code = `pair(1, 2); // no error
      pair(1); // error
      pair(1, 2, 3); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Expected 2 arguments, but got 1.
      Line 3: Expected 2 arguments, but got 3."
    `)
  })

  it('lists are pairs', () => {
    const code = `const x1: Pair<number, null> = list(1);
      const x2: Pair<number, Pair<string, null>> = list(1, '2');
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })
})

describe('list', () => {
  it('handles type mismatches correctly', () => {
    const code = `const x1: List<number> = list(1, 2, 3); // no error
      const x2: List<number> = list(); // no error
      const x3: List<number> = list('1'); // error
      const x4: List<number> = 1; // error
      const x5: List<number> = list(1, '2'); // error
      const x6: List<number | string> = list(1, '2'); // no error
      const x7: List<number, string> = list(1, '2'); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 7: Generic type 'List' requires 1 type argument(s).
      Line 3: Type 'List<string>' is not assignable to type 'List<number>'.
      Line 4: Type 'number' is not assignable to type 'List<number>'.
      Line 5: Type 'List<number | string>' is not assignable to type 'List<number>'."
    `)
  })

  it('pair with list as tail type is considered a list', () => {
    const code = `const x1: List<number> = pair(1, null);
      const x2: List<number | string> = pair(1, pair('1', null));
      const x3: List<number | string> = pair(1, list('1'));
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })
})

describe('head', () => {
  it('takes in 1 pair or list as argument only', () => {
    const code = `head(pair(1, 2)); // no error
      head(list(1)); // no error
      head(null); // no error, error will be caught at runtime
      head(list(1, 2), 3); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 4: Expected 1 arguments, but got 2."`
    )
  })

  it('return type is type of first element in pair', () => {
    const code = `const x1: Pair<number, number> = pair(1, 2);
    const x2: Pair<string, number> = pair('1', 2);
    const x3: Pair<string | number, number> = pair('1', 2);
    const x4: number = head(x1); // no error
    const x5: string = head(x2); // no error
    const x6: string = head(pair('1', 2)); // no error
    const x7: string = head(x3); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 7: Type 'string | number' is not assignable to type 'string'."`
    )
  })

  it('return type is element type in list', () => {
    const code = `const x1: List<number> = list(1, 2);
    const x2: List<string> = list('1', '2');
    const x3: List<string | number> = list('1', 2);
    const x4: number = head(x1); // no error
    const x5: string = head(x2); // no error
    const x6: string = head(list('1', 2)); // error
    const x7: string = head(x3); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 6: Type 'string | number' is not assignable to type 'string'.
      Line 7: Type 'string | number' is not assignable to type 'string'."
    `)
  })
})

describe('tail', () => {
  it('takes in 1 pair or list as argument only', () => {
    const code = `tail(pair(1, 2)); // no error
      tail(list(1)); // no error
      tail(null); // no error, error will be caught at runtime
      tail(list(1, 2), 3); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 4: Expected 1 arguments, but got 2."`
    )
  })

  it('return type is type of second element in pair', () => {
    const code = `const x1: Pair<number, number> = pair(1, 2);
    const x2: Pair<number, string> = pair(1, '2');
    const x3: Pair<number, string | number> = pair(1, '2');
    const x4: number = tail(x1); // no error
    const x5: string = tail(x2); // no error
    const x6: string = tail(pair(1, '2')); // no error
    const x7: string = tail(x3); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 7: Type 'string | number' is not assignable to type 'string'."`
    )
  })

  it('return type for list is same as original list', () => {
    const code = `const x1: List<number> = list(1, 2);
    const x2: List<string> = list('1', '2');
    const x3: List<string | number> = list('1', 2);
    const x4: List<number> = tail(x1); // no error
    const x5: List<string> = tail(x2); // no error
    const x6: List<number> = tail(list('1', 2)); // error
    const x7: List<string> = tail(x3); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 6: Type 'List<string | number>' is not assignable to type 'List<number>'.
      Line 7: Type 'List<string | number>' is not assignable to type 'List<string>'."
    `)
  })
})
