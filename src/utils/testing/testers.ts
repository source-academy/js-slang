import type { Program } from 'estree'
import { Chapter, type Context } from '../../types'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'

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
