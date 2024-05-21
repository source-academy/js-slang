import { parseError, runInContext } from '..'
import { defineBuiltin } from '../createContext'

import { mockContext } from '../mocks/context'
import { Chapter, type Value } from '../types'
import { stripIndent } from '../utils/formatters'
import { type TestBuiltins } from '../utils/testing'
import { expectFinishedResult, expectResult } from '../utils/testing/testers'
import { expectResultsToEqual, testMultipleCases } from '../utils/testing/testers'

async function testCodeSnippet(
  code: string,
  expected: Value,
  chapter: Chapter = Chapter.SOURCE_1,
  builtins: TestBuiltins = {}
) {
  const context = mockContext(chapter)
  Object.entries(builtins).forEach(([key, value]) => defineBuiltin(context, key, value))

  const result = await runInContext(code, context)
  if (result.status !== 'finished') {
    console.log(context.errors)
  }

  expectFinishedResult(result)
  expect(result.value).toEqual(expected)
}

describe('Test basic code snippets', () => {
  expectResultsToEqual([
    ['Empty code returns undefined', '', undefined],
    ['Single string evaluates to itself', '"42";', '42'],
    ['Multiline string evaluates to itself', '"1\\n1";', '1\n1'],
    ['Single number evaluates to itself', '42;', 42],
    ['Single boolean evaluates to itself', 'true;', true],

    [
      'Assignment has value',
      `
          let a = 1;
          let b = a = 4;
          b === 4 && a === 4;
        `,
      true,
      Chapter.SOURCE_3
    ],

    // Arrays
    [
      'Array assignment has value',
      `
          let arr = [];
          const a = arr[0] = 1;
          const b = arr[1] = arr[2] = 4;
          arr[0] === 1 && arr[1] === 4 && arr[2] === 4;
        `,
      true,
      Chapter.SOURCE_3
    ],
    [
      'Accessing array at non-existent index returns undefined',
      `
          const a = [1,2];
          a[3];
        `,
      undefined,
      Chapter.SOURCE_4
    ],

    // Objects
    [
      'Simple object assignment and retrieval',
      `
          const o = {};
          o.a = 1;
          o.a;
        `,
      1,
      Chapter.LIBRARY_PARSER
    ],
    [
      'Deep object assignment and retrieval',
      `
          const o = {};
          o.a = {};
          o.a.b = {};
          o.a.b.c = "string";
          o.a.b.c;
        `,
      'string',
      Chapter.LIBRARY_PARSER
    ],
    [
      'Accessing non-existent property on object returns undefined',
      `
          const o = {};
          o.nonexistent;
        `,
      undefined,
      Chapter.LIBRARY_PARSER
    ],

    // Control structures
    [
      'true if with empty block works',
      `
          if (true) {
          } else {}
        `,
      undefined
    ],
    [
      'true if with non-empty block works',
      `
          if (true) { 1; }
          else {}
        `,
      1
    ],
    [
      'false if with empty else works',
      `
          if (false) {}
          else {}
        `,
      undefined
    ],
    [
      'false if with non empty else works',
      `
          if (false) {}
          else { 2; }
        `,
      2
    ],

    // Builtins,
    ['Display returns the value it is displaying', '25*display(1+1);', 50],
    [
      'apply_in_underlying_javascript',
      'apply_in_underlying_javascript((a, b, c) => a * b * c, list(2, 5, 6));',
      60,
      Chapter.SOURCE_4
    ],

    // General snippets
    [
      'Factorial arrow function',
      `
          const fac = (i) => i === 1 ? 1 : i * fac(i-1);
          fac(5);
        `,
      120
    ],
    [
      'Rest parameters work',
      `
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
      28,
      Chapter.SOURCE_3
    ],
    [
      'Can overwrite lets when assignment is allowed',
      `
          function test() {
            let variable = false;
            variable = true;
            return variable;
          }
          test();
        `,
      true,
      Chapter.SOURCE_3
    ]
  ])

  test('Arrow function definition returns itself', () => {
    return expectResult('() => 42;', Chapter.SOURCE_1)
      .toMatchInlineSnapshot(`[Function]`)
  })
})

describe('Test equal', () => {
  testMultipleCases<[string, string, boolean]>(
    [
      // Primitives
      ['Equality between numbers', '1', '1', true],
      ['Inequality between numbers', '1', '2', false],
      ['Equality for null', 'null', 'null', true],
      ['Equality for strings', "'str'", "'str'", true],
      ['Inequality for strings', "''", "'str'", false],

      // Lists
      ['Equality for lists created using list()', 'list(1, 2)', 'list(1, 2)', true],
      ['Equality for lists created using pair()', `list(1, 2)`, 'pair(1, pair(2, null))', true],
      [
        'Equality for nested lists',
        'list(1, list(2, 3))',
        'pair(1, pair(pair(2, pair(3, null)), null))',
        true
      ],
      ['Inequality for different lists 1', `list(1, 2)`, 'pair(1, 2)', false],
      ['Inequality for different lists 2', 'list(1, 2, 3)', 'list(1, list(2, 3))', false]
    ],
    async ([value0, value1, expected]) => {
      return testCodeSnippet(`equal(${value0}, ${value1});`, expected, Chapter.SOURCE_2)
    }
  )
})

describe('Test matching with JS', () => {
  function evalWithBuiltins(code: string, testBuiltins: TestBuiltins) {
    // Ugly, but if you know how to `eval` code with some builtins attached, please change this.
    let evalstring = ''
    for (const key in testBuiltins) {
      if (testBuiltins.hasOwnProperty(key)) {
        evalstring = evalstring + 'const ' + key + ' = testBuiltins.' + key + '; '
      }
    }
    // tslint:disable-next-line:no-eval
    return eval(evalstring + code)
  }

  const toString = (x: Value) => '' + x

  testMultipleCases<[string] | [string, TestBuiltins]>(
    [
      [
        'Primitives toString matches JS',
        `
          toString(true) +
          toString(false) +
          toString(1) +
          toString(1.5) +
          toString(null) +
          toString(undefined) +
          toString(NaN);
        `,
        { toString }
      ],
      ['Objects toString matches their JS', 'toString({a: 1});', { toString }],
      ['Arrays toString matches their JS', 'toString([1, 2]);', { toString }],

      ['Test true conditional expression', 'true ? true : false;'],
      ['Test false conditional expression', 'false ? true : false;'],
      ['Test && shortcircuiting', 'false && 1();'],
      ['Test || shortcircuiting', 'true || 1();']
    ],
    async ([code, builtins]) => {
      const expected = evalWithBuiltins(code, builtins ?? {})
      return testCodeSnippet(code, expected, Chapter.LIBRARY_PARSER)
    }
  )

  const expressionCases: string[] = [
    'false && true',
    'false && false',
    'true && false',
    'true && true',
    'false || true',
    'false || false',
    'true || false',
    'true || true'
  ]

  testMultipleCases(
    expressionCases.map(code => [`Test ${code}`, `${code};`] as [string, string]),
    ([code]) => {
      const expected = evalWithBuiltins(code, {})
      return testCodeSnippet(code, expected, Chapter.LIBRARY_PARSER)
    }
  )
})

describe('Test recursion snippets', () => {
  testMultipleCases(
    [
      [
        'Simple arrow function infinite recursion represents CallExpression well',
        '(x => x(x)(x))(x => x(x)(x));',
        stripIndent`
        Line 1: Maximum call stack size exceeded
          x(x => x(x)(x))..  x(x => x(x)(x))..  x(x => x(x)(x))..`
      ],
      [
        'Arrow function infinite recursion with list args represents CallExpression well',
        `
        const f = xs => append(f(xs), list());
        f(list(1, 2));
      `,
        stripIndent`
        Line 2: Maximum call stack size exceeded
          f([1, [2, null]])..  f([1, [2, null]])..  f([1, [2, null]])..`
      ],
      [
        'Arrow function infinite recursion with different args represents CallExpression well',
        `
        const f = i => f(i+1) - 1;
        f(0);
      `,
        expect.stringMatching(
          /^Line 2: Maximum call stack size exceeded\n\ *(f\(\d*\)[^f]{2,4}){3}/
        )
      ],
      [
        'Simple function infinite recursion represents CallExpression well',
        'function f(x) { return x(x)(x); } f(f);',
        stripIndent`
        Line 1: Maximum call stack size exceeded
          x(function f(x) {
          return x(x)(x);
        })..  x(function f(x) {
          return x(x)(x);
        })..  x(function f(x) {
          return x(x)(x);
        })..`
      ],
      [
        'Function infinite recursion with list args represents CallExpression well',
        `
        function f(xs) { return append(f(xs), list()); }
        f(list(1, 2));
      `,
        stripIndent`
        Line 2: Maximum call stack size exceeded
          f([1, [2, null]])..  f([1, [2, null]])..  f([1, [2, null]])..`
      ],
      [
        'Function infinite recursion with different args represents CallExpression well',
        `
        function f(i) { return f(i+1) - 1; }
        f(0);
      `,
        expect.stringMatching(
          /^Line 2: Maximum call stack size exceeded\n\ *(f\(\d*\)[^f]{2,4}){3}/
        )
      ]
    ],
    async ([code, expected]) => {
      const context = mockContext(Chapter.SOURCE_2)
      const result = await runInContext(code, context, { executionMethod: 'cse-machine' })
      expect(result.status).toEqual('error')

      const parsed = parseError(context.errors)
      expect(parsed).toEqual(expected)
    },
    false,
    30000
  )
})
