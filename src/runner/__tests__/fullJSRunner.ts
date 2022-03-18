import { Context, Result, runInContext } from '../..'
import { UndefinedVariable } from '../../errors/errors'
import { mockContext } from '../../mocks/context'
import { FatalSyntaxError } from '../../parser/parser'
import { SourceError } from '../../types'
import { locationDummyNode } from '../../utils/astCreator'

interface CodeSnippetTestCase {
  name: string
  snippet: string
  value: any
  errors: SourceError[]
}

test('Source builtins are accessible in fullJS program', async () => {
  const fullJSProgram: string = `
    parse('head(list(1,2,3));');
    `
  const fullJSContext: Context = mockContext(-1, 'default')
  await runInContext(fullJSProgram, fullJSContext)

  expect(fullJSContext.errors.length).toBeLessThanOrEqual(0)
})

test('Simulate fullJS REPL', async () => {
  const fullJSContext: Context = mockContext(-1, 'default')
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
  const LITERAL_OBJECT: CodeSnippetTestCase = {
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
  }

  const OOP: CodeSnippetTestCase = {
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
  }

  const ARRAY_MAP: CodeSnippetTestCase = {
    name: 'ARRAY MAP',
    snippet: `
          [1,2,3,4].map(num => num + 1);
          `,
    value: [2, 3, 4, 5],
    errors: []
  }

  const ARRAY_FILTER: CodeSnippetTestCase = {
    name: 'ARRAY FILTER',
    snippet: `
          [1,2,3,4].filter(num => num > 2);
          `,
    value: [3, 4],
    errors: []
  }

  it.each([LITERAL_OBJECT, OOP, ARRAY_FILTER, ARRAY_MAP, OOP])(
    `%p`,
    async ({ snippet, value, errors }: CodeSnippetTestCase) => {
      const fullJSContext: Context = mockContext(-1, 'default')
      const result = await runInContext(snippet, fullJSContext)

      expect(result.status).toStrictEqual('finished')
      expect((result as any).value).toStrictEqual(value)
      expect(fullJSContext.errors).toStrictEqual(errors)
    }
  )
})

describe('Error locations are handled well in fullJS', () => {
  const UNDEFINED_VARIABLE: CodeSnippetTestCase = {
    name: 'UNDEFINED VARIABLE',
    snippet: `
          const a = b;
          `,
    value: undefined,
    errors: [new UndefinedVariable('b', locationDummyNode(2, 20))]
  }

  const SYNTAX_ERROR: CodeSnippetTestCase = {
    name: 'SYNTAX ERROR',
    snippet: `function(){}`,
    value: undefined,
    errors: [
      new FatalSyntaxError(
        { start: { line: 1, column: 8 }, end: { line: 1, column: 9 } },
        'SyntaxError: Unexpected token (1:8)'
      )
    ]
  }

  const REFERENCE_ERROR: CodeSnippetTestCase = {
    name: 'REFERENCE ERROR',
    snippet: `
            function h() {
              g();
            }
            h();
            `,
    value: undefined,
    errors: [new UndefinedVariable('g', locationDummyNode(3, 14))]
  }

  it.each([UNDEFINED_VARIABLE, SYNTAX_ERROR, REFERENCE_ERROR])(
    `%p`,
    async ({ snippet, value, errors }: CodeSnippetTestCase) => {
      const fullJSContext: Context = mockContext(-1, 'default')
      const result = await runInContext(snippet, fullJSContext)

      expect(result.status).toStrictEqual('error')
      expect((result as any).value).toStrictEqual(value)
      expect(fullJSContext.errors).toStrictEqual(errors)
    }
  )
})
