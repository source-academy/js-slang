import { describe, expect, test } from 'vitest'
import type { Position } from 'acorn/dist/acorn'
import type { SourceLocation } from 'estree'

import { findDeclaration, getScope, runInContext } from '../index'
import type { Value } from '../types'
import { Chapter } from '../langs'
import { stripIndent } from '../utils/formatters'
import {
  createTestContext,
  expectFinishedResult,
  expectParsedError,
  testSuccess
} from '../utils/testing'
import type { TestOptions } from '../utils/testing/types'
import {
  assertFinishedResultValue,
  evalWithBuiltins,
  processTestOptions
} from '../utils/testing/misc'

const toString = (x: Value) => '' + x

test('Empty code returns undefined', () => {
  return expectFinishedResult('').toBe(undefined)
})

test('Single string self-evaluates to itself', () => {
  return expectFinishedResult("'42';").toBe('42')
})

test('Multiline string self-evaluates to itself', () => {
  return expectFinishedResult('`1\n1`;').toBe(`1
1`)
})

test('Allow display to return value it is displaying', () => {
  return expectFinishedResult('25*(display(1+1));').toBe(50)
})

test('Single number self-evaluates to itself', () => {
  return expectFinishedResult('42;').toBe(42)
})

test('Single boolean self-evaluates to itself', () => {
  return expectFinishedResult('true;').toBe(true)
})

test('Arrow function definition returns itself', async () => {
  const {
    result: { value }
  } = await testSuccess('() => 42;')
  return expect(value).toMatchInlineSnapshot(`[Function]`)
})

test('Builtins hide their implementation when toString', async () => {
  const {
    result: { value }
  } = await testSuccess('toString(pair);', {
    chapter: Chapter.SOURCE_2,
    testBuiltins: { toString }
  })

  expect(value).toMatchInlineSnapshot(`
    "function pair(left, right) {
    	[implementation hidden]
    }"
  `)
})

test('functions toString (mostly) matches up with JS', async () => {
  const code = stripIndent`
    function f(x) {
    return 5;
  }
  toString(a=>a) + toString(f);
  `
  const options: TestOptions = { testBuiltins: { toString } }
  const { result } = await testSuccess(code, options)

  expect(result.value.replace(/ /g, '')).toEqual(
    evalWithBuiltins(code, options.testBuiltins).replace(/ /g, '')
  )
})

test('Factorial arrow function', () => {
  return expectFinishedResult(
    stripIndent`
    const fac = (i) => i === 1 ? 1 : i * fac(i-1);
    fac(5);
  `
  ).toBe(120)
})

test('parseError for missing semicolon', () => {
  return expectParsedError('42').toEqual('Line 1: Missing semicolon at the end of statement')
})

test('parseError for template literals with expressions', () => {
  return expectParsedError('`${1}`;').toEqual(
    'Line 1: Expressions are not allowed in template literals (\`multiline strings\`)'
  )
})

test(
  'Simple arrow function infinite recursion represents CallExpression well',
  { timeout: 30_000 },
  () => {
    return expectParsedError('(x => x(x)(x))(x => x(x)(x));').toContain(
      `RangeError: Maximum call stack size exceeded`
    )
  }
)

test(
  'Simple function infinite recursion represents CallExpression well',
  { timeout: 30_000 },
  () => {
    return expectParsedError('function f(x) {return x(x)(x);} f(f);').toContain(
      `RangeError: Maximum call stack size exceeded`
    )
  }
)

test('Cannot overwrite consts even when assignment is allowed', () => {
  return expectParsedError(
    stripIndent`
    function test(){
      const constant = 3;
      constant = 4;
      return constant;
    }
    test();
  `,
    Chapter.SOURCE_3
  ).toEqual('Line 3: Cannot assign new value to constant constant.')
})

test('Assignment has value', () => {
  return expectFinishedResult(
    stripIndent`
    let a = 1;
    let b = a = 4;
    b === 4 && a === 4;
  `,

    Chapter.SOURCE_3
  ).toBe(true)
})

test('Array assignment has value', () => {
  return expectFinishedResult(
    stripIndent`
    let arr = [];
    const a = arr[0] = 1;
    const b = arr[1] = arr[2] = 4;
    arr[0] === 1 && arr[1] === 4 && arr[2] === 4;
  `,
    Chapter.SOURCE_3
  ).toBe(true)
})

test('Can overwrite lets when assignment is allowed', () => {
  return expectFinishedResult(
    stripIndent`
    function test() {
      let variable = false;
      variable = true;
      return variable;
    }
    test();
  `,
    Chapter.SOURCE_3
  ).toBe(true)
})

test(
  'Arrow function infinite recursion with list args represents CallExpression well',
  { timeout: 30_000 },
  () => {
    return expectParsedError(
      stripIndent`
    const f = xs => append(f(xs), list());
    f(list(1, 2));
  `,
      Chapter.SOURCE_2
    ).toContain(`RangeError: Maximum call stack size exceeded`)
  }
)

test(
  'Function infinite recursion with list args represents CallExpression well',
  { timeout: 30_000 },
  () => {
    return expectParsedError(
      stripIndent`
    function f(xs) { return append(f(xs), list()); }
    f(list(1, 2));
  `
    ).toEqual('Line 1: Name append not declared.')
  }
)

test(
  'Arrow function infinite recursion with different args represents CallExpression well',
  { timeout: 30_000 },
  () => {
    return expectParsedError(stripIndent`
    const f = i => f(i+1) - 1;
    f(0);
  `).toContain(`RangeError: Maximum call stack size exceeded`)
  }
)

test(
  'Function infinite recursion with different args represents CallExpression well',
  { timeout: 30_000 },
  () => {
    return expectParsedError(stripIndent`
    function f(i) { return f(i+1) - 1; }
    f(0);
  `).toContain(`RangeError: Maximum call stack size exceeded`)
  }
)

test('Functions passed into non-source functions remain equal', () => {
  return expectFinishedResult(
    stripIndent`
    function t(x, y, z) {
      return x + y + z;
    }
    identity(t) === t && t(1, 2, 3) === 6;
  `,
    { chapter: Chapter.SOURCE_3, testBuiltins: { 'identity(x)': (x: any) => x } }
  ).toBe(true)
})

test('Accessing array with nonexistent index returns undefined', () => {
  return expectFinishedResult(
    stripIndent`
    const a = [];
    a[1];
  `,
    Chapter.SOURCE_4
  ).toBe(undefined)
})

test('Accessing object with nonexistent property returns undefined', () => {
  return expectFinishedResult(
    stripIndent`
    const o = {};
    o.nonexistent;
  `,
    Chapter.LIBRARY_PARSER
  ).toBe(undefined)
})

test('Simple object assignment and retrieval', () => {
  return expectFinishedResult(
    stripIndent`
    const o = {};
    o.a = 1;
    o.a;
  `,
    Chapter.LIBRARY_PARSER
  ).toBe(1)
})

test('Deep object assignment and retrieval', () => {
  return expectFinishedResult(
    stripIndent`
    const o = {};
    o.a = {};
    o.a.b = {};
    o.a.b.c = "string";
    o.a.b.c;
  `,
    Chapter.LIBRARY_PARSER
  ).toBe('string')
})

test('Test apply_in_underlying_javascript', () => {
  return expectFinishedResult(
    stripIndent`
    apply_in_underlying_javascript((a, b, c) => a * b * c, list(2, 5, 6));
  `,
    Chapter.SOURCE_4
  ).toBe(60)
})

test('Test equal for primitives', () => {
  return expectFinishedResult(
    stripIndent`
    equal(1, 1) && equal("str", "str") && equal(null, null) && !equal(1, 2) && !equal("str", "");
  `,
    Chapter.SOURCE_2
  ).toBe(true)
})

test('Test equal for lists', () => {
  return expectFinishedResult(
    stripIndent`
    equal(list(1, 2), pair(1, pair(2, null))) && equal(list(1, 2, 3, 4), list(1, 2, 3, 4));
  `,
    Chapter.SOURCE_2
  ).toBe(true)
})

test('Test equal for different lists', () => {
  return expectFinishedResult(
    stripIndent`
    !equal(list(1, 2), pair(1, 2)) && !equal(list(1, 2, 3), list(1, list(2, 3)));
  `,
    Chapter.SOURCE_2
  ).toBe(true)
})

test('true if with empty if works', () => {
  return expectFinishedResult(
    stripIndent`
    if (true) {
    } else {
    }
  `
  ).toBe(undefined)
})

test('true if with nonempty if works', () => {
  return expectFinishedResult(
    stripIndent`
    if (true) {
      1;
    } else {
    }
  `
  ).toBe(1)
})

test('false if with empty else works', () => {
  return expectFinishedResult(
    stripIndent`
    if (false) {
    } else {
    }
  `
  ).toBe(undefined)
})

test('false if with nonempty if works', () => {
  return expectFinishedResult(
    stripIndent`
    if (false) {
    } else {
      2;
    }
  `
  ).toBe(2)
})

describe('matchJSTests', () => {
  async function expectToMatchJS(code: string, rawOptions: TestOptions = {}) {
    const options = processTestOptions(rawOptions)
    if (options.testBuiltins) {
      options.testBuiltins = {
        ...options.testBuiltins,
        toString
      }
    } else {
      options.testBuiltins = { toString }
    }

    const { result } = await testSuccess(code, options)

    expect(evalWithBuiltins(code, options.testBuiltins)).toEqual(result.value)
  }

  test('primitives toString matches up with JS', async () => {
    const code = stripIndent`
      toString(true) +
      toString(false) +
      toString(1) +
      toString(1.5) +
      toString(null) +
      toString(undefined) +
      toString(NaN);
      `

    const options: TestOptions = {
      testBuiltins: { toString },
      chapter: Chapter.SOURCE_2
    }
    const { result } = await testSuccess(code, options)
    expect(evalWithBuiltins(code, options.testBuiltins)).toEqual(result.value)
  })

  test('test true conditional expression', () => {
    return expectToMatchJS('true ? true : false;')
  })

  test('test false conditional expression', () => {
    return expectToMatchJS('false ? true : false;')
  })

  test('test false && true', () => {
    return expectToMatchJS('false && true;')
  })

  test('test false && false', () => {
    return expectToMatchJS('false && false;')
  })

  test('test true && false', () => {
    return expectToMatchJS('true && false;')
  })

  test('test true && true', () => {
    return expectToMatchJS('true && true;')
  })

  test('test && shortcircuiting', () => {
    return expectToMatchJS('false && 1();')
  })

  test('test false || true', () => {
    return expectToMatchJS('false || true;')
  })

  test('test false || false', () => {
    return expectToMatchJS('false || false;')
  })

  test('test true || false', () => {
    return expectToMatchJS('true || false;')
  })

  test('test true || true', () => {
    return expectToMatchJS('true || true;')
  })

  test('test || shortcircuiting', () => {
    return expectToMatchJS('true || 1();')
  })

  test('Objects toString matches up with JS', () => {
    return expectToMatchJS('toString({a: 1});', {
      chapter: Chapter.LIBRARY_PARSER
    })
  })

  test('Arrays toString matches up with JS', () => {
    return expectToMatchJS('toString([1, 2]);', {
      chapter: Chapter.SOURCE_3
    })
  })
})

test('Rest parameters work', () => {
  return expectFinishedResult(
    stripIndent`
    function rest(a, b, ...c) {
      let sum = a + b;
      for (let i = 0; i < array_length(c); i = i + 1) {
        sum = sum + c[i];
      }
      return sum;
    }
    rest(1, 2); // no error
    rest(1, 2, ...[3, 4, 5],  ...[6, 7], ...[]);
  `,
    Chapter.SOURCE_3
  ).toEqual(28)
})

test('Test context reuse', async () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const init = stripIndent`
  let i = 0;
  function f() {
    i = i + 1;
    return i;
  }
  i;
  `

  const snippets: [string, any][] = [
    [init, 0],
    ['i = 100; f();', 101],
    ['f(); i;', 102],
    ['i;', 102]
  ]

  for (const [code, expected] of snippets) {
    const result = await runInContext(code, context)
    assertFinishedResultValue(result, expected)
  }
})

class SourceLocationTestResult {
  start: Position
  end: Position
  constructor(startLine: number, startCol: number, endLine: number, endCol: number) {
    this.start = { line: startLine, column: startCol }
    this.end = { line: endLine, column: endCol }
  }
}

function expectResultsToMatch(
  actualResult: SourceLocation | null | undefined,
  expectedResult: SourceLocationTestResult | null | undefined
) {
  if (expectedResult === null) {
    expect(actualResult).toBeNull()
    return
  }
  if (expectedResult === undefined) {
    expect(actualResult).toBeUndefined()
    return
  }
  expect(actualResult).not.toBeNull()
  expect(actualResult).not.toBeUndefined()
  if (actualResult === null || actualResult === undefined) {
    return
  }
  expect(actualResult.start.line).toEqual(expectedResult.start.line)
  expect(actualResult.start.column).toEqual(expectedResult.start.column)
  expect(actualResult.end.line).toEqual(expectedResult.end.line)
  expect(actualResult.end.column).toEqual(expectedResult.end.column)
}

test('Find variable declaration in global scope', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  let i = 0;
  function f() {
    i = i + 1;
    return i;
  }
  i;
  `
  const expected = new SourceLocationTestResult(1, 4, 1, 5)
  const actual = findDeclaration(code, context, { line: 6, column: 0 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find variable declaration in global scope from occurrence in function scope', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  let i = 0;
  function f() {
    i = i + 1;
    return i;
  }
  i;
  `
  const expected = new SourceLocationTestResult(1, 4, 1, 5)
  const actual = findDeclaration(code, context, { line: 4, column: 9 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find variable declaration in function scope from occurrence in function scope', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  let i = 0;
  function f() {
    let i = 2;
    return i;
  }
  i;
  `
  const expected = new SourceLocationTestResult(3, 6, 3, 7)
  const actual = findDeclaration(code, context, { line: 4, column: 9 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find no declaration from occurrence when there is no declaration (syntax error)', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  function f() {
    let i = 2;
    return i;
  }
  x;
  `
  const expected = null
  const actual = findDeclaration(code, context, { line: 5, column: 0 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find no declaration from selection that does not refer to a declaration', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  let i = 0;
  function f() {
    let i = 2;
    return i;
  }
  i;
  `
  const expected = null
  const actual = findDeclaration(code, context, { line: 4, column: 3 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find function declaration', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  let i = 0;
  function foo() {
    let i = 2;
    return i;
  }
  foo();
  `
  const expected = new SourceLocationTestResult(2, 9, 2, 12)
  const actual = findDeclaration(code, context, { line: 6, column: 0 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find function param declaration', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  function timesTwo(num) {
    return num * 2;
  }
  timesTwo(2);
  `
  const expected = new SourceLocationTestResult(1, 18, 1, 21)
  const actual = findDeclaration(code, context, { line: 2, column: 9 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find variable declaration with same name as function param declaration', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  function timesTwo(num) {
    return num * 2;
  }
  const num = 2;
  timesTwo(num);
  `
  const expected = new SourceLocationTestResult(4, 6, 4, 9)
  const actual = findDeclaration(code, context, { line: 5, column: 9 })
  expectResultsToMatch(actual, expected)
  // expect(actual).toMatchSnapshot()
})

test('Find arrow function declaration', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  let i = 0;
  const foo = () => {
    let i = 2;
    return i;
  }
  foo();
  `
  const expected = new SourceLocationTestResult(2, 6, 2, 9)
  const actual = findDeclaration(code, context, { line: 6, column: 0 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find arrow function param declaration', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  const timesTwo = (num) => {
    return num * 2;
  }
  timesTwo(2);
  `
  const expected = new SourceLocationTestResult(1, 18, 1, 21)
  const actual = findDeclaration(code, context, { line: 2, column: 9 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find variable declaration with same name as arrow function param declaration', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  const timesTwo = (num) => {
    return num * 2;
  }
  const num = 2;
  timesTwo(num);
  `
  const expected = new SourceLocationTestResult(4, 6, 4, 9)
  const actual = findDeclaration(code, context, { line: 5, column: 9 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find declaration in init of for loop', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  let x = 1;
  for (let i = 1; i <= 2; i++) {
    x = x * i;
  }
  x;
  `
  const expected = new SourceLocationTestResult(2, 9, 2, 10)
  const actual = findDeclaration(code, context, { line: 3, column: 10 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find variable declaration with same name as init of for loop', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  let x = 1;
  for (let i = 1; i <= 2; i++) {
    x = x * i;
  }
  const i = 2;
  i;
  `
  const expected = new SourceLocationTestResult(5, 6, 5, 7)
  const actual = findDeclaration(code, context, { line: 6, column: 0 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find variable declaration in block statement', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  {
    let x = 1;
    x = x + 2;
  }
  let x = 2;
  x = x + 2;
  `
  const expected = new SourceLocationTestResult(2, 6, 2, 7)
  const actual = findDeclaration(code, context, { line: 3, column: 2 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})
test('Find variable declaration of same name as variable declaration in block statement', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  {
    let x = 1;
    x = x + 2;
  }
  let x = 2;
  x = x + 2;
  `
  const expected = new SourceLocationTestResult(5, 4, 5, 5)
  const actual = findDeclaration(code, context, { line: 6, column: 0 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find declaration of of variable in update statement of a for loop', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = stripIndent`
  for (let x = 10; x < 12; ++x) {
      display(x);
  }
  let x = 5;
  `
  const expected = new SourceLocationTestResult(1, 9, 1, 10)
  const actual = findDeclaration(code, context, { line: 1, column: 17 })
  expectResultsToMatch(actual, expected)
  expect(actual).toMatchSnapshot()
})

test('Find scope of a variable declaration', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = `{
    const x = 1;
    {
        const x = 2;
        function f(y) {
            return x + y;
        }
    }
    display(x);
  }`
  const expected = [
    new SourceLocationTestResult(1, 0, 3, 4),
    new SourceLocationTestResult(8, 5, 10, 3)
  ]
  const actual = getScope(code, context, { line: 2, column: 10 })
  expected.forEach((expectedRange, index) => {
    const actualRange = new SourceLocationTestResult(
      actual[index].start.line,
      actual[index].start.column,
      actual[index].end.line,
      actual[index].end.column
    )
    expectResultsToMatch(actualRange, expectedRange)
  })
  expect(actual).toMatchSnapshot()
})

test('Find scope of a nested variable declaration', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = `{
    const x = 1;
    {
        const x = 2;
        function f(y) {
            return x + y;
        }
    }
    display(x);
  }`
  const expected = [new SourceLocationTestResult(3, 4, 8, 5)]
  const actual = getScope(code, context, { line: 4, column: 15 })
  expected.forEach((expectedRange, index) => {
    const actualRange = new SourceLocationTestResult(
      actual[index].start.line,
      actual[index].start.column,
      actual[index].end.line,
      actual[index].end.column
    )
    expectResultsToMatch(actualRange, expectedRange)
  })
  expect(actual).toMatchSnapshot()
})

test('Find scope of a function parameter', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = `{
    const x = 1;
    {
        const x = 2;
        function f(y) {
            return x + y;
        }
    }
    display(x);
  }`
  const expected = [new SourceLocationTestResult(5, 22, 7, 9)]
  const actual = getScope(code, context, { line: 5, column: 19 })
  expected.forEach((expectedRange, index) => {
    const actualRange = new SourceLocationTestResult(
      actual[index].start.line,
      actual[index].start.column,
      actual[index].end.line,
      actual[index].end.column
    )
    expectResultsToMatch(actualRange, expectedRange)
  })
  expect(actual).toMatchSnapshot()
})

test('Find scope of a function declaration', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = `{
    const x = 1;
    {
        const x = 2;
        function f(y) {
            return x + y;
        }
    }
    display(x);
  }`
  const expected = [new SourceLocationTestResult(3, 4, 8, 5)]
  const actual = getScope(code, context, { line: 5, column: 17 })
  expected.forEach((expectedRange, index) => {
    const actualRange = new SourceLocationTestResult(
      actual[index].start.line,
      actual[index].start.column,
      actual[index].end.line,
      actual[index].end.column
    )
    expectResultsToMatch(actualRange, expectedRange)
  })
  expect(actual).toMatchSnapshot()
})

test('Find scope of a variable declaration with more nesting', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = `{
    const x = 1;
    {
        const x = 2;
        function f(y) {
            for (let x = 10; x < 20; x = x + 1) {
                display(x);
            }
            return x + y;
        }
        for (let x = 10; x < 20; x = x + 1) {
            display(x);
        }
    }
    display(x);
  }`
  const expected = [
    new SourceLocationTestResult(3, 4, 6, 12),
    new SourceLocationTestResult(8, 13, 11, 8),
    new SourceLocationTestResult(13, 9, 14, 5)
  ]
  const actual = getScope(code, context, { line: 4, column: 15 })
  expected.forEach((expectedRange, index) => {
    const actualRange = new SourceLocationTestResult(
      actual[index].start.line,
      actual[index].start.column,
      actual[index].end.line,
      actual[index].end.column
    )
    expectResultsToMatch(actualRange, expectedRange)
  })
  expect(actual).toMatchSnapshot()
})

test('Find scope of a variable declaration with multiple blocks', () => {
  const context = createTestContext(Chapter.SOURCE_4)
  const code = `const x = 1;
    {
        const x = 2;
        {
            const x = 3;
        }
        x ;
        {
            const x = 4;
        }
        x;
        {
            const x = 5;
        }
    }
    x;`
  const expected = [
    new SourceLocationTestResult(2, 4, 4, 8),
    new SourceLocationTestResult(6, 9, 8, 8),
    new SourceLocationTestResult(10, 9, 12, 8),
    new SourceLocationTestResult(14, 9, 15, 5)
  ]
  const actual = getScope(code, context, { line: 3, column: 15 })
  expected.forEach((expectedRange, index) => {
    const actualRange = new SourceLocationTestResult(
      actual[index].start.line,
      actual[index].start.column,
      actual[index].end.line,
      actual[index].end.column
    )
    expectResultsToMatch(actualRange, expectedRange)
  })
  expect(actual).toMatchSnapshot()
})
