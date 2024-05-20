import type { Position } from 'acorn/dist/acorn'
import type { SourceLocation } from 'estree'
import { stripIndent } from '../utils/formatters'
import { createTestContext } from '../utils/testing'
import { Chapter } from '../types'
import { findDeclaration, getScope } from '..'

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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
  const context = createTestContext({ chapter: Chapter.SOURCE_4 })
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
