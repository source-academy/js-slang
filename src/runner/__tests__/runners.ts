import { parseError, runInContext } from '../..'
import { UndefinedVariable } from '../../errors/errors'
import { mockContext } from '../../utils/testing/mocks'
import { FatalSyntaxError } from '../../parser/errors'
import { Chapter, Variant } from '../../types'
import { type SourceError } from '../../errors/errorBase'
import { locationDummyNode } from '../../utils/ast/astCreator'
import { htmlErrorHandlingScript } from '../htmlRunner'
import {
  expectParsedError,
  expectFinishedResult,
  testFailure,
  testSuccess
} from '../../utils/testing'
import { assertFinishedResultValue, testWithChapters } from '../../utils/testing/misc'

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
  const fullJSProgram: string = `parse('head(list(1,2,3));');`
  await testSuccess(fullJSProgram, Chapter.FULL_JS)
})

test('Simulate fullJS REPL', async () => {
  const fullJSContext = mockContext(Chapter.FULL_JS, Variant.DEFAULT)
  const replStatements: [string, any][] = [
    ['const x = 1;', undefined],
    ['x;', 1],
    ['const y = x + 1;', undefined],
    ['y;', 2]
  ]

  for (const replStatement of replStatements) {
    const [statement, expectedResult] = replStatement
    const result = await runInContext(statement, fullJSContext)
    assertFinishedResultValue(result, expectedResult)
    expect(fullJSContext.errors).toStrictEqual([])
  }
})

describe('Native javascript programs are valid in fullJSRunner', () => {
  it.each(JAVASCRIPT_CODE_SNIPPETS_NO_ERRORS.map(({ name, ...tc }) => [name, tc]))(
    `%s`,
    (_, { snippet, value }) => {
      return expectFinishedResult(snippet, Chapter.FULL_JS).toEqual(value)
    }
  )
})

describe('Error locations are handled well in fullJS', () => {
  it.each(JAVASCRIPT_CODE_SNIPPETS_ERRORS.map(({ name, ...tc }) => [name, tc]))(
    `%s`,
    (_, { snippet, errors }) => {
      const expected = parseError(errors)
      return expectParsedError(snippet, Chapter.FULL_JS).toEqual(expected)
    }
  )
})

// Source Native Unit Tests

describe('Additional JavaScript features are not available in Source Native', () => {
  describe.each(JAVASCRIPT_CODE_SNIPPETS_NO_ERRORS.map(({ name, snippet }) => [name, snippet]))(
    `%s`,
    (_, snippet) => {
      // Test all chapters from Source 1 - 4
      testWithChapters(
        Chapter.SOURCE_1,
        Chapter.SOURCE_2,
        Chapter.SOURCE_3,
        Chapter.SOURCE_4
      )(chapter => testFailure(snippet, { chapter, variant: Variant.NATIVE }))
    }
  )
})

describe('Functions in Source libraries (e.g. list, streams) are available in Source Native', () => {
  describe('List functions are present in Source Native', () => {
    // The following snippet is equivalent to sum(list(1..10))
    const sourceNativeSnippet =
      'accumulate((x, y) => x + y , 0, append(build_list(x => x + 1, 5), enum_list(6, 10)));'

    // Test chapters from Source 2 - 4
    testWithChapters(
      Chapter.SOURCE_2,
      Chapter.SOURCE_3,
      Chapter.SOURCE_4
    )(chapter =>
      expectFinishedResult(sourceNativeSnippet, { chapter, variant: Variant.NATIVE }).toStrictEqual(
        55
      )
    )
  })

  describe('Stream functions are present in Source Native', () => {
    // The following snippet is equivalent to sum(list(stream(1..10)))
    const sourceNativeSnippet: string =
      'accumulate((x, y) => x + y, 0, stream_to_list(stream_append(build_stream(x => x + 1, 5), enum_stream(6, 10))));'

    // Test chapters from Source 3 - 4
    testWithChapters(
      Chapter.SOURCE_3,
      Chapter.SOURCE_4
    )(chapter =>
      expectFinishedResult(sourceNativeSnippet, { chapter, variant: Variant.NATIVE }).toStrictEqual(
        55
      )
    )
  })
})

// HTML Unit Tests

test('Error handling script is injected in HTML code', () => {
  const htmlDocument = '<p>Hello World!</p>'
  return expectFinishedResult(htmlDocument, Chapter.HTML).toStrictEqual(
    htmlErrorHandlingScript + htmlDocument
  )
})
