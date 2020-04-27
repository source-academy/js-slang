import { Value } from '../types'
import { stripIndent } from '../utils/formatters'
import {
  createTestContext,
  expectParsedError,
  expectParsedErrorNoErrorSnapshot,
  expectParsedErrorNoSnapshot,
  expectResult,
  expectToLooselyMatchJS,
  expectToMatchJS
} from '../utils/testing'
import { findDeclaration, getScope } from '../index'
import { Position } from 'acorn/dist/acorn'
import { SourceLocation } from 'estree'

const toString = (x: Value) => '' + x

test('Empty code returns undefined', () => {
  return expectResult('').toBe(undefined)
})

test('Single string self-evaluates to itself', () => {
  return expectResult("'42';").toBe('42')
})

test('Allow display to return value it is displaying', () => {
  return expectResult('25*(display(1+1));').toBe(50)
})

test('Single number self-evaluates to itself', () => {
  return expectResult('42;').toBe(42)
})

test('Single boolean self-evaluates to itself', () => {
  return expectResult('true;').toBe(true)
})

test('Arrow function definition returns itself', () => {
  return expectResult('() => 42;').toMatchInlineSnapshot(`[Function]`)
})

test('Builtins hide their implementation when stringify', () => {
  return expectResult('stringify(pair);', { chapter: 2, native: true }).toMatchInlineSnapshot(`
            "function pair(left, right) {
            	[implementation hidden]
            }"
          `)
})

test('Builtins hide their implementation when toString', () => {
  return expectResult('toString(pair);', { chapter: 2, native: true, testBuiltins: { toString } })
    .toMatchInlineSnapshot(`
            "function pair(left, right) {
            	[implementation hidden]
            }"
          `)
})

test('Objects toString matches up with JS', () => {
  return expectToMatchJS('toString({a: 1});', {
    chapter: 100,
    native: true,
    testBuiltins: { toString }
  })
})

test('Arrays toString matches up with JS', () => {
  return expectToMatchJS('toString([1, 2]);', {
    chapter: 3,
    native: true,
    testBuiltins: { toString }
  })
})

test('functions toString (mostly) matches up with JS', () => {
  return expectToLooselyMatchJS(
    stripIndent`
  function f(x) {
    return 5;
  }
  toString(a=>a) + toString(f);
  `,
    { native: true, testBuiltins: { toString } }
  )
})

test('primitives toString matches up with JS', () => {
  return expectToMatchJS(
    stripIndent`
    toString(true) +
    toString(false) +
    toString(1) +
    toString(1.5) +
    toString(null) +
    toString(undefined) +
    toString(NaN);
    `,
    { chapter: 2, native: true, testBuiltins: { toString } }
  )
})

test('Factorial arrow function', () => {
  return expectResult(
    stripIndent`
    const fac = (i) => i === 1 ? 1 : i * fac(i-1);
    fac(5);
  `,
    { native: true }
  ).toBe(120)
})

test('parseError for missing semicolon', () => {
  return expectParsedError('42').toMatchInlineSnapshot(
    `"Line 1: Missing semicolon at the end of statement"`
  )
})

test('Simple arrow function infinite recursion represents CallExpression well', () => {
  return expectParsedErrorNoErrorSnapshot('(x => x(x)(x))(x => x(x)(x));').toMatchInlineSnapshot(`
            "Line 1: Maximum call stack size exceeded
              x(x => x(x)(x))..  x(x => x(x)(x))..  x(x => x(x)(x)).."
          `)
}, 30000)

test('Simple function infinite recursion represents CallExpression well', () => {
  return expectParsedErrorNoErrorSnapshot('function f(x) {return x(x)(x);} f(f);')
    .toMatchInlineSnapshot(`
            "Line 1: Maximum call stack size exceeded
              x(function f(x) {
              return x(x)(x);
            })..  x(function f(x) {
              return x(x)(x);
            })..  x(function f(x) {
              return x(x)(x);
            }).."
          `)
}, 30000)

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
    { chapter: 3, native: true }
  ).toMatchInlineSnapshot(`"Line 3: Cannot assign new value to constant constant."`)
})

test('Can overwrite lets when assignment is allowed', () => {
  return expectResult(
    stripIndent`
    function test() {
      let variable = false;
      variable = true;
      return variable;
    }
    test();
  `,
    { chapter: 3, native: true }
  ).toBe(true)
})

test('Arrow function infinite recursion with list args represents CallExpression well', () => {
  return expectParsedErrorNoErrorSnapshot(
    stripIndent`
    const f = xs => append(f(xs), list());
    f(list(1, 2));
  `,
    { chapter: 2 }
  ).toMatchInlineSnapshot(`
            "Line 1: Maximum call stack size exceeded
              f([1, [2, null]])..  f([1, [2, null]])..  f([1, [2, null]]).."
          `)
}, 30000)

test('Function infinite recursion with list args represents CallExpression well', () => {
  return expectParsedErrorNoErrorSnapshot(
    stripIndent`
    function f(xs) { return append(f(xs), list()); }
    f(list(1, 2));
  `,
    { chapter: 2 }
  ).toMatchInlineSnapshot(`
            "Line 1: Maximum call stack size exceeded
              f([1, [2, null]])..  f([1, [2, null]])..  f([1, [2, null]]).."
          `)
}, 30000)

test('Arrow function infinite recursion with different args represents CallExpression well', () => {
  return expectParsedErrorNoSnapshot(stripIndent`
    const f = i => f(i+1) - 1;
    f(0);
  `).toEqual(
    expect.stringMatching(/^Line 1: Maximum call stack size exceeded\n\ *(f\(\d*\)[^f]{2,4}){3}/)
  )
}, 30000)

test('Function infinite recursion with different args represents CallExpression well', () => {
  return expectParsedErrorNoSnapshot(stripIndent`
    function f(i) { return f(i+1) - 1; }
    f(0);
  `).toEqual(
    expect.stringMatching(
      /^Line 1: Error: \"Infinite recursion \(or runtime error\) detected. Did you forget your base case\?\"/
    )
  )
}, 30000)

test('Functions passed into non-source functions remain equal', () => {
  return expectResult(
    stripIndent`
    function t(x, y, z) {
      return x + y + z;
    }
    identity(t) === t && t(1, 2, 3) === 6;
  `,
    { chapter: 1, testBuiltins: { 'identity(x)': (x: any) => x }, native: true }
  ).toBe(true)
})

test('Accessing array with nonexistent index returns undefined', () => {
  return expectResult(
    stripIndent`
    const a = [];
    a[1];
  `,
    { chapter: 4, native: true }
  ).toBe(undefined)
})

test('Accessing object with nonexistent property returns undefined', () => {
  return expectResult(
    stripIndent`
    const o = {};
    o.nonexistent;
  `,
    { chapter: 100, native: true }
  ).toBe(undefined)
})

test('Simple object assignment and retrieval', () => {
  return expectResult(
    stripIndent`
    const o = {};
    o.a = 1;
    o.a;
  `,
    { chapter: 100, native: true }
  ).toBe(1)
})

test('Deep object assignment and retrieval', () => {
  return expectResult(
    stripIndent`
    const o = {};
    o.a = {};
    o.a.b = {};
    o.a.b.c = "string";
    o.a.b.c;
  `,
    { chapter: 100, native: true }
  ).toBe('string')
})

test('Test apply_in_underlying_javascript', () => {
  return expectResult(
    stripIndent`
    apply_in_underlying_javascript((a, b, c) => a * b * c, list(2, 5, 6));
  `,
    { chapter: 4, native: true }
  ).toBe(60)
})

test('Test equal for primitives', () => {
  return expectResult(
    stripIndent`
    equal(1, 1) && equal("str", "str") && equal(null, null) && !equal(1, 2) && !equal("str", "");
  `,
    { chapter: 2, native: true }
  ).toBe(true)
})

test('Test equal for lists', () => {
  return expectResult(
    stripIndent`
    equal(list(1, 2), pair(1, pair(2, null))) && equal(list(1, 2, 3, 4), list(1, 2, 3, 4));
  `,
    { chapter: 2, native: true }
  ).toBe(true)
})

test('Test equal for different lists', () => {
  return expectResult(
    stripIndent`
    !equal(list(1, 2), pair(1, 2)) && !equal(list(1, 2, 3), list(1, list(2, 3)));
  `,
    { chapter: 2, native: true }
  ).toBe(true)
})

test('true if with empty if works', () => {
  return expectResult(
    stripIndent`
    if (true) {
    } else {
    }
  `,
    { native: true }
  ).toBe(undefined)
})

test('true if with nonempty if works', () => {
  return expectResult(
    stripIndent`
    if (true) {
      1;
    } else {
    }
  `,
    { native: true }
  ).toBe(1)
})

test('false if with empty else works', () => {
  return expectResult(
    stripIndent`
    if (false) {
    } else {
    }
  `,
    { native: true }
  ).toBe(undefined)
})

test('false if with nonempty if works', () => {
  return expectResult(
    stripIndent`
    if (false) {
    } else {
      2;
    }
  `,
    { native: true }
  ).toBe(2)
})

test('test true conditional expression', () => {
  return expectToMatchJS('true ? true : false;', { native: true })
})

test('test false conditional expression', () => {
  return expectToMatchJS('false ? true : false;', { native: true })
})

test('test false && true', () => {
  return expectToMatchJS('false && true;', { native: true })
})

test('test false && false', () => {
  return expectToMatchJS('false && false;', { native: true })
})

test('test true && false', () => {
  return expectToMatchJS('true && false;', { native: true })
})

test('test true && true', () => {
  return expectToMatchJS('true && true;', { native: true })
})

test('test && shortcircuiting', () => {
  return expectToMatchJS('false && 1();', { native: true })
})

test('test false || true', () => {
  return expectToMatchJS('false || true;', { native: true })
})

test('test false || false', () => {
  return expectToMatchJS('false || false;', { native: true })
})

test('test true || false', () => {
  return expectToMatchJS('true || false;', { native: true })
})

test('test true || true', () => {
  return expectToMatchJS('true || true;', { native: true })
})

test('test || shortcircuiting', () => {
  return expectToMatchJS('true || 1();', { native: true })
})

test('Test context reuse', async () => {
  const context = createTestContext({ chapter: 4 })
  const init = stripIndent`
  let i = 0;
  function f() {
    i = i + 1;
    return i;
  }
  i;
  `
  await expectResult(init, { context, native: true }).toBe(0)
  await expectResult('i = 100; f();', { context, native: true }).toBe(101)
  await expectResult('f(); i;', { context, native: true }).toBe(102)
  return expectResult('i;', { context, native: true }).toBe(102)
})

class SourceLocationTestResult {
  start: Position
  end: Position
  constructor(startLine: number, startCol: number, endLine: number, endCol: number) {
    this.start = { line: startLine, column: startCol, offset: 0 }
    this.end = { line: endLine, column: endCol, offset: 0 }
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
  const context = createTestContext({ chapter: 4 })
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
