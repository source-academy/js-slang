import { Context, Result, parseError, runInContext } from '../..'
import { UndefinedVariable } from '../../errors/errors'
import { mockContext } from '../../mocks/context'
import { FatalSyntaxError } from '../../parser/errors'
import { Chapter, Finished, Variant, type ExecutionMethod, type SourceError } from '../../types'
import { locationDummyNode } from '../../utils/ast/astCreator'
import { expectFinishedResult } from '../../utils/testing/misc'
import { expectResultsToEqual } from '../../utils/testing'
import { htmlErrorHandlingScript } from '../htmlRunner'

interface CodeSnippetTestCase {
  name: string
  snippet: string
  value: any
  errors: SourceError[]
}

const JAVASCRIPT_CODE_SNIPPETS_NO_ERRORS: CodeSnippetTestCase[] = [
  {
    name: 'LITERAL OBJECT',
    snippet: `
          const sourceLanguage = {
              chapter: 1,
              variant: "default",
              displayName: "Source 1"
          }
          sourceLanguage["displayName"];
          `,
    value: 'Source 1',
    errors: []
  },
  {
    name: 'OOP',
    snippet: `
          class Rectangle {
              constructor(height, width) {
                this.height = height;
                this.width = width;
              }
          }
          const rect1 = new Rectangle(1080, 1920);
          rect1.height;
          `,
    value: 1080,
    errors: []
  },
  {
    name: 'ARRAY MAP',
    snippet: `
          [1,2,3,4].map(num => num + 1);
          `,
    value: [2, 3, 4, 5],
    errors: []
  },
  {
    name: 'ARRAY FILTER',
    snippet: `
          [1,2,3,4].filter(num => num > 2);
          `,
    value: [3, 4],
    errors: []
  },
  {
    name: 'TRY CATCH',
    snippet: `
            let a = 0;
            try {
              nonExistentFunction();
            } catch (error) {
              // catch error
            } finally {
              a++;
            }
            a;
           `,
    value: 1,
    errors: []
  }
]

const JAVASCRIPT_CODE_SNIPPETS_ERRORS: CodeSnippetTestCase[] = [
  {
    name: 'UNDEFINED VARIABLE',
    snippet: `
          const a = b;
          `,
    value: undefined,
    errors: [new UndefinedVariable('b', locationDummyNode(2, 20, 'source'))]
  },
  {
    name: 'SYNTAX ERROR',
    snippet: `function(){}`,
    value: undefined,
    errors: [
      new FatalSyntaxError(
        { start: { line: 1, column: 8 }, end: { line: 1, column: 9 }, source: undefined },
        'SyntaxError: Unexpected token (1:8)'
      )
    ]
  },
  {
    name: 'REFERENCE ERROR',
    snippet: `
            function h() {
              g();
            }
            h();
            `,
    value: undefined,
    errors: [new UndefinedVariable('g', locationDummyNode(3, 14, 'source'))]
  }
]

// FullJS Unit Tests

test('Source builtins are accessible in fullJS program', async () => {
  const fullJSProgram: string = `
    parse('head(list(1,2,3));');
    `
  const fullJSContext: Context = mockContext(Chapter.FULL_JS, Variant.DEFAULT)
  await runInContext(fullJSProgram, fullJSContext)

  expect(fullJSContext.errors.length).toBeLessThanOrEqual(0)
})

test('Simulate fullJS REPL', async () => {
  const fullJSContext: Context = mockContext(Chapter.FULL_JS, Variant.DEFAULT)
  const replStatements: [string, any][] = [
    ['const x = 1;', undefined],
    ['x;', 1],
    ['const y = x + 1;', undefined],
    ['y;', 2]
  ]

  for (const replStatement of replStatements) {
    const [statement, expectedResult] = replStatement
    const result: Result = await runInContext(statement, fullJSContext)
    expect(result.status).toStrictEqual('finished')
    expect((result as any).value).toStrictEqual(expectedResult)
    expect(fullJSContext.errors).toStrictEqual([])
  }
})

describe('Native javascript programs are valid in fullJSRunner', () => {
  it.each([...JAVASCRIPT_CODE_SNIPPETS_NO_ERRORS])(
    `%p`,
    async ({ snippet, value, errors }: CodeSnippetTestCase) => {
      const fullJSContext: Context = mockContext(Chapter.FULL_JS, Variant.DEFAULT)
      const result = await runInContext(snippet, fullJSContext)

      expect(result.status).toStrictEqual('finished')
      expect((result as any).value).toStrictEqual(value)
      expect(fullJSContext.errors).toStrictEqual(errors)
    }
  )
})

describe('Error locations are handled well in fullJS', () => {
  it.each([...JAVASCRIPT_CODE_SNIPPETS_ERRORS])(
    `%p`,
    async ({ snippet, value, errors }: CodeSnippetTestCase) => {
      const fullJSContext: Context = mockContext(Chapter.FULL_JS, Variant.DEFAULT)
      const result = await runInContext(snippet, fullJSContext)

      expect(result.status).toStrictEqual('error')
      expect((result as any).value).toStrictEqual(value)
      expect(fullJSContext.errors).toStrictEqual(errors)
    }
  )
})

// Source Native Unit Tests

describe('Additional JavaScript features are not available in Source Native', () => {
  it.each([...JAVASCRIPT_CODE_SNIPPETS_NO_ERRORS])(
    `%p`,
    async ({ snippet }: CodeSnippetTestCase) => {
      // Test all chapters from Source 1 - 4
      for (let chapterNum = 0; chapterNum <= 4; chapterNum++) {
        const sourceNativeContext: Context = mockContext(chapterNum, Variant.NATIVE)
        const result = await runInContext(snippet, sourceNativeContext)

        expect(result.status).toStrictEqual('error')
        expect(sourceNativeContext.errors.length).toBeGreaterThan(0)
      }
    }
  )
})

describe('Functions in Source libraries (e.g. list, streams) are available in Source Native', () => {
  test('List functions are present in Source Native', async () => {
    // Test chapters from Source 2 - 4
    for (let chapterNum = 2; chapterNum <= 4; chapterNum++) {
      const sourceNativeContext: Context = mockContext(chapterNum, Variant.NATIVE)
      // The following snippet is equivalent to sum(list(1..10))
      const sourceNativeSnippet: string =
        'accumulate((x, y) => x + y , 0, append(build_list(x => x + 1, 5), enum_list(6, 10)));'
      const result = await runInContext(sourceNativeSnippet, sourceNativeContext)

      expect(result.status).toStrictEqual('finished')
      expect((result as any).value).toStrictEqual(55)
      expect(sourceNativeContext.errors.length).toBe(0)
    }
  })
  test('Stream functions are present in Source Native', async () => {
    // Test chapters from Source 3 - 4
    for (let chapterNum = 3; chapterNum <= 4; chapterNum++) {
      const sourceNativeContext: Context = mockContext(chapterNum, Variant.NATIVE)
      // The following snippet is equivalent to sum(list(stream(1..10)))
      const sourceNativeSnippet: string =
        'accumulate((x, y) => x + y, 0, stream_to_list(stream_append(build_stream(x => x + 1, 5), enum_stream(6, 10))));'
      const result = await runInContext(sourceNativeSnippet, sourceNativeContext)

      expect(result.status).toStrictEqual('finished')
      expect((result as any).value).toStrictEqual(55)
      expect(sourceNativeContext.errors.length).toBe(0)
    }
  })
})

test('Test context reuse', async () => {
  const context = mockContext(Chapter.SOURCE_4)
  const init = `
    let i = 0;
    function f() {
      i = i + 1;
      return i;
    }
    i;
  `

  const snippet: [string, number][] = [
    ['i = 100; f();', 101],
    ['f(); i;', 102],
    ['i;', 102]
  ]

  await runInContext(init, context)
  for (const [code, expected] of snippet) {
    const result = await runInContext(code, context)
    expectFinishedResult(result)
    expect(result.value).toEqual(expected)
  }
})

describe('Test tail call return for native runner', () => {
  // TODO: Check if this test is still relevant
  // test.skip('Check that stack is at most 10k in size', () => {
  //   return expectParsedErrorNoSnapshot(stripIndent`
  //     function f(x) {
  //       if (x <= 0) {
  //         return 0;
  //       } else {
  //         return 1 + f(x-1);
  //       }
  //     }
  //     f(10000);
  //   `).toEqual(expect.stringMatching(/Maximum call stack size exceeded\n([^f]*f){3}/))
  // }, 10000)

  expectResultsToEqual(
    [
      [
        'Simple tail call returns work',
        `
      function f(x, y) {
        if (x <= 0) {
          return y;
        } else {
          return f(x-1, y+1);
        }
      }
      f(5000, 5000);
      `,
        10000
      ],
      [
        'Tail call in conditional expressions work',
        `
        function f(x, y) {
          return x <= 0 ? y : f(x-1, y+1);
        }
        f(5000, 5000);
      `,
        10000
      ],
      [
        'Tail call in boolean operators work',
        `
        function f(x, y) {
          if (x <= 0) {
            return y;
          } else {
            return false || f(x-1, y+1);
          }
        }
        f(5000, 5000);
      `,
        10000
      ],
      [
        'Tail call in nested mix of conditional expressions and boolean operators work',
        `
        function f(x, y) {
          return x <= 0 ? y : false || x > 0 ? f(x-1, y+1) : 'unreachable';
        }
        f(5000, 5000);
      `,
        10000
      ],
      [
        'Tail calls in arrow block functions work',
        `
      const f = (x, y) => {
        if (x <= 0) {
          return y;
        } else {
          return f(x-1, y+1);
        }
      };
      f(5000, 5000);
      `,
        10000
      ],
      [
        'Tail calls in expression arrow functions work',
        `
      const f = (x, y) => x <= 0 ? y : f(x-1, y+1);
      f(5000, 5000);
      `,
        10000
      ],
      [
        'Tail calls in mutual recursion work',
        `
        function f(x, y) {
          if (x <= 0) {
            return y;
          } else {
            return g(x-1, y+1);
          }
        }
        function g(x, y) {
          if (x <= 0) {
            return y;
          } else {
            return f(x-1, y+1);
          }
        }
        f(5000, 5000);
      `,
        10000
      ],
      [
        'Tail calls in mutual recursion with arrow functions work',
        `
        const f = (x, y) => x <= 0 ? y : g(x-1, y+1);
        const g = (x, y) => x <= 0 ? y : f(x-1, y+1);
        f(5000, 5000);
      `,
        10000
      ],
      [
        'Tail calls in mixed tail-call/non-tail-call recursion work',
        `
        function f(x, y, z) {
          if (x <= 0) {
            return y;
          } else {
            return f(x-1, y+f(0, z, 0), z);
          }
        }
        f(5000, 5000, 2);
      `,
        15000
      ]
    ],
    Chapter.SOURCE_1,
    false,
    10000
  )
})

describe('Tests for all runners', () => {
  const methodsToTest: ExecutionMethod[] = ['cse-machine', 'stepper', 'native']

  test("Runners won't allow assignments to consts even when assignment is allowed", () => {
    const snippet = `
      function test(){
        const constant = 3;
        constant = 4;
        return constant;
      }
      test();
    `

    return Promise.all(
      methodsToTest.map(async method => {
        const context = mockContext(Chapter.SOURCE_3)
        const result = await runInContext(snippet, context, { executionMethod: method })
        expect(result.status).toEqual('error')
        expect(parseError(context.errors)).toEqual(
          'Line 4: Cannot assign new value to constant constant.'
        )
      })
    )
  })
})
// HTML Unit Tests

test('Error handling script is injected in HTML code', async () => {
  const htmlDocument: string = '<p>Hello World!</p>'
  const htmlContext: Context = mockContext(Chapter.HTML, Variant.DEFAULT)
  const result = await runInContext(htmlDocument, htmlContext)

  expect(result.status).toStrictEqual('finished')
  expect((result as Finished).value).toStrictEqual(htmlErrorHandlingScript + htmlDocument)
})
