import type { Program } from 'estree'
import { Chapter, type Context } from '../../types'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { parseError, runInContext } from '../..'
import { expectFinishedResult } from '.'

export type TestCase<T extends Array<any>> = [string, ...T]

/**
 * Convenience wrapper for testing multiple cases with the same
 * test function
 */
export function testMultipleCases<T extends Array<any>>(
  cases: [string, ...T][],
  tester: (args: T, i: number) => void | Promise<void>,
  includeIndex?: boolean,
  timeout?: number
) {
  const withIndex = cases.map(([desc, ...c], i) => {
    const newDesc = includeIndex ? `${i + 1}. ${desc}` : desc
    return [newDesc, i, ...c] as [string, number, ...T]
  })
  test.each(withIndex)('%s', (_, i, ...args) => tester(args, i), timeout)
}

/**
 * Used when something has to be tested with two different values
 */
export function testTrueAndFalseCases<T extends [string, ...any[]], U extends any[]>(
  desc: string,
  varName: string,
  cases: T[],
  mapper: (c: T, i: number) => [[string, ...U], [string, ...U]],
  tester: (args: U, i: number) => void | Promise<void>,
  includeIndex?: boolean,
  timeout?: number
) {
  const [trueCases, falseCases] = cases.reduce(
    ([trueRes, falseRes], c, i) => {
      const [trueCase, falseCase] = mapper(c, i)
      return [
        [...trueRes, trueCase],
        [...falseRes, falseCase]
      ]
    },
    [[], []]
  )

  describe(`${desc} with ${varName}: true`, () =>
    testMultipleCases(trueCases, tester, includeIndex, timeout))
  describe(`${desc} with ${varName}: false`, () =>
    testMultipleCases(falseCases, tester, includeIndex, timeout))
}

/**
 * Convenience function for testing the expected output of running
 * a single line of code
 */

export function astTester<ExpectedError>(
  func: (prog: Program, context: Context, expectedError: ExpectedError | undefined) => void,
  testCases: (
    | [desc: string, code: string]
    | [desc: string, code: string, expectedError: ExpectedError]
  )[],
  chapter: Chapter = Chapter.SOURCE_4,
  includeIndex?: boolean,
  timeout?: number
) {
  const fullCases = testCases.map(([desc, code, err]) => {
    const context = mockContext(chapter)
    const program = parse(code, context)
    if (!program) {
      throw context.errors[0]
    }

    return [desc, program, context, err] as [string, Program, Context, ExpectedError | undefined]
  })

  testMultipleCases(fullCases, args => func(...args), includeIndex, timeout)
}

export function expectResult(code: string, chapter: Chapter) {
  const context = mockContext(chapter)
  return expect(
    runInContext(code, context).then(result => {
      expectFinishedResult(result)
      return result.value
    })
  ).resolves
}

type ExpectResultsTestCase = [string, string, any] | [string, string, any, Chapter]
export function expectResultsToEqual(
  snippets: ExpectResultsTestCase[],
  defaultChapter: Chapter = Chapter.SOURCE_1,
  includeIndex?: boolean,
  timeout?: number
) {
  const fullSnippets = snippets.map(snippet => {
    const chapter = snippet.length === 4 ? snippet[3] : defaultChapter
    return [snippet[0], snippet[1], snippet[2], chapter] as [string, string, any, Chapter]
  })

  testMultipleCases(
    fullSnippets,
    ([code, expected, chapter]) => {
      return expectResult(code, chapter).toEqual(expected)
    },
    includeIndex,
    timeout
  )
}

export function expectParsedError(code: string, chapter: Chapter, verbose?: boolean) {
  const context = mockContext(chapter)
  return expect(
    runInContext(code, context).then(result => {
      expect(result.status).toEqual('error')
      return parseError(context.errors, verbose)
    })
  ).resolves
}

export function expectParsedErrorsToEqual(
  snippets: (ExpectResultsTestCase | [...ExpectResultsTestCase, boolean])[],
  defaultChapter: Chapter = Chapter.SOURCE_1,
  includeIndex?: boolean,
  timeout?: number
) {
  const fullSnippets = snippets.map(snippet => {
    const chapter = snippet.length >= 4 ? snippet[3] : defaultChapter
    const verbose = snippet.length === 5 ? snippet[4] : false
    return [snippet[0], snippet[1], snippet[2], chapter, verbose] as [
      string,
      string,
      any,
      Chapter,
      boolean
    ]
  })

  testMultipleCases(
    fullSnippets,
    ([code, expected, chapter, verbose]) => {
      return expectParsedError(code, chapter, verbose).toEqual(expected)
    },
    includeIndex,
    timeout
  )
}
