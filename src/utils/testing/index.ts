import type { Program } from 'estree'
import { Chapter, type Context, type CustomBuiltIns, type Value, Variant } from '../../types'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { parseError, runInContext } from '../..'
import createContext, { defineBuiltin } from '../../createContext'
import { expectFinishedResult } from './misc'

export interface TestBuiltins {
  [builtinName: string]: any
}

export interface TestContext extends Context {
  displayResult: string[]
  promptResult: string[]
  alertResult: string[]
  visualiseListResult: Value[]
}

export function createTestContext({
  context,
  chapter = Chapter.SOURCE_1,
  variant = Variant.DEFAULT,
  testBuiltins = {}
}: {
  context?: TestContext
  chapter?: Chapter
  variant?: Variant
  testBuiltins?: TestBuiltins
} = {}): TestContext {
  if (context !== undefined) {
    return context
  } else {
    const testContext: TestContext = {
      ...createContext(chapter, variant, [], undefined, {
        rawDisplay: (str1, str2, _externalContext) => {
          testContext.displayResult.push((str2 === undefined ? '' : str2 + ' ') + str1)
          return str1
        },
        prompt: (str, _externalContext) => {
          testContext.promptResult.push(str)
          return null
        },
        alert: (str, _externalContext) => {
          testContext.alertResult.push(str)
        },
        visualiseList: value => {
          testContext.visualiseListResult.push(value)
        }
      } as CustomBuiltIns),
      displayResult: [],
      promptResult: [],
      alertResult: [],
      visualiseListResult: []
    }
    Object.entries(testBuiltins).forEach(([key, value]) => defineBuiltin(testContext, key, value))

    return testContext
  }
}

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
 * Used when each test case has to be tested twice with a different boolean value each time.
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
 * Convenience function for testing the expected output of parsing
 * a single line of code
 */

export function astTester<ExpectedValue>(
  func: (prog: Program, context: Context, expectedError: ExpectedValue | undefined) => void,
  testCases: (
    | [desc: string, code: string]
    | [desc: string, code: string, expectedError: ExpectedValue]
  )[],
  chapter: Chapter = Chapter.SOURCE_4,
  variant: Variant = Variant.DEFAULT,
  includeIndex?: boolean,
  timeout?: number
) {
  const fullCases = testCases.map(([desc, code, err]) => {
    const context = mockContext(chapter, variant)
    const program = parse(code, context)
    if (!program) {
      throw context.errors[0]
    }

    return [desc, program, context, err] as [string, Program, Context, ExpectedValue | undefined]
  })

  testMultipleCases(fullCases, args => func(...args), includeIndex, timeout)
}

export type TestOptions =
  | {
      chapter?: Chapter
      variant?: Variant
      testBuiltins?: TestBuiltins
    }
  | Chapter

async function testInContext(code: string, rawOptions: TestOptions) {
  const options: TestOptions =
    typeof rawOptions === 'number'
      ? {
          chapter: rawOptions
        }
      : rawOptions

  const context = createTestContext(options)
  const result = await runInContext(code, context)
  return {
    context,
    result
  }
}

/**
 * Run the given code and expect it to finish without errors
 * @returns Context and result of test
 */
export async function testSuccess(code: string, options: TestOptions = {}) {
  const { context, result } = await testInContext(code, options)
  if (result.status !== 'finished') {
    console.log(context.errors)
  }

  expectFinishedResult(result)
  return {
    context,
    result
  }
}

/**
 * Run the given code and expect it to finish with errors
 * @returns String value of parsed errors
 */
export async function testFailure(code: string, options: TestOptions = {}) {
  const res = await testInContext(code, options)
  expect(res.result.status).toEqual('error')
  return parseError(res.context.errors)
}

/**
 * Run the given code and expect it to finish without errors. Use
 * as if using `expect()`
 */
export function expectResult(code: string, options: TestOptions) {
  return expect(
    testInContext(code, options).then(({ result, context }) => {
      if (result.status === 'error') {
        console.log(context.errors)
      }
      expectFinishedResult(result)
      return result.value
    })
  ).resolves
}

type ExpectResultsTestCaseWithoutChapter = [desc: string, code: string, expected: any]
type ExpectResultsTestCaseWithChapter = [
  desc: string,
  code: string,
  expected: any,
  options: TestOptions
]

/**
 * A single test case consists of 3-4 parts:
 * 1. Description of the test. This will not be passed to the testing function.
 * 2. Code to test
 * 3. Value that the code is expected to return after evaluation. This value is matched using `toEqual`
 * 4. (Optional) Specify test options to run the test with. By default, this is `Chapter.SOURCE_1`
 */
type ExpectResultsTestCase = ExpectResultsTestCaseWithChapter | ExpectResultsTestCaseWithoutChapter

/**
 * Run `expectResult` on multiple test cases
 * @param defaultOptions Provide test options which will be used by default if none are given for the test case
 * @param includeIndex Include the index value of each case in its description
 * @param timeout Timeout value to pass to Jest
 */
export function expectResultsToEqual(
  snippets: ExpectResultsTestCase[],
  defaultOptions: TestOptions = Chapter.SOURCE_1,
  includeIndex?: boolean,
  timeout?: number
) {
  const fullSnippets = snippets.map(snippet => {
    const options = snippet.length === 4 ? snippet[3] : defaultOptions
    return [snippet[0], snippet[1], snippet[2], options] as [string, string, any, TestOptions]
  })

  testMultipleCases(
    fullSnippets,
    ([code, expected, options]) => {
      return expectResult(code, options).toEqual(expected)
    },
    includeIndex,
    timeout
  )
}

/**
 * Expect the code to error, then test the parsed error value. Use as if using
 * `expect`
 */
export function expectParsedError(code: string, options: TestOptions = {}, verbose?: boolean) {
  return expect(
    testInContext(code, options).then(({ result, context }) => {
      expect(result.status).toEqual('error')
      return parseError(context.errors, verbose)
    })
  ).resolves
}

/**
 * Run `expectParsedError` on multiple test cases
 * @param defaultOptions Provide test options which will be used by default if none are given for the test case
 * @param includeIndex Include the index value of each case in its description
 * @param timeout Timeout value to pass to Jest
 */
export function expectParsedErrorsToEqual(
  snippets: (ExpectResultsTestCase | [...ExpectResultsTestCase, boolean])[],
  defaultOptions: TestOptions = Chapter.SOURCE_1,
  includeIndex?: boolean,
  timeout?: number
) {
  const fullSnippets = snippets.map(snippet => {
    const options = snippet.length >= 4 ? snippet[3] : defaultOptions
    const verbose = snippet.length === 5 ? snippet[4] : false
    return [snippet[0], snippet[1], snippet[2], options, verbose] as [
      string,
      string,
      any,
      TestOptions,
      boolean
    ]
  })

  testMultipleCases(
    fullSnippets,
    ([code, expected, options, verbose]) => {
      return expectParsedError(code, options, verbose).toEqual(expected)
    },
    includeIndex,
    timeout
  )
}

export function expectDisplayResult(code: string, options: TestOptions = {}) {
  return expect(
    testInContext(code, options).then(({ context, result }) => {
      expectFinishedResult(result)
      return context.displayResult
    })
  ).resolves
}

export async function expectDifferentParsedErrors(
  code0: string,
  code1: string,
  options: TestOptions = {}
) {
  const [err0, err1] = await Promise.all([testFailure(code0, options), testFailure(code1, options)])

  expect(err0).not.toEqual(err1)
}
