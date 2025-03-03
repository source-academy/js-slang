import { Chapter, type CustomBuiltIns } from '../../types'
import { parseError, runInContext } from '../..'
import createContext, { defineBuiltin } from '../../createContext'
import { expectFinishedResult, processTestOptions } from './misc'
import { mockContext } from './mocks'
import type { TestContext, TestOptions, TestResults } from './types'

export function createTestContext(rawOptions: TestOptions = {}): TestContext {
  const { chapter, variant, testBuiltins }: Exclude<TestOptions, Chapter> =
    typeof rawOptions === 'number'
      ? {
          chapter: rawOptions
        }
      : rawOptions

  const testContext: TestResults = {
    displayResult: [],
    promptResult: [],
    alertResult: [],
    visualiseListResult: []
  }

  const customBuiltIns: CustomBuiltIns = {
    rawDisplay(str1, str2, _externalContext) {
      testContext.displayResult.push((str2 === undefined ? '' : str2 + ' ') + str1)
      return str1
    },
    prompt(str, _externalContext) {
      testContext.promptResult.push(str)
      return null
    },
    alert(str, _externalContext) {
      testContext.alertResult.push(str)
    },
    visualiseList(value) {
      testContext.visualiseListResult.push(value)
    }
  }

  const evalContext = createContext(chapter, variant, [], undefined, customBuiltIns)
  Object.entries(testBuiltins ?? {}).forEach(([key, value]) =>
    defineBuiltin(evalContext, key, value)
  )

  return {
    ...evalContext,
    displayResult: [],
    promptResult: [],
    alertResult: [],
    visualiseListResult: []
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

async function testInContext(code: string, rawOptions: TestOptions) {
  const options = processTestOptions(rawOptions)
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
export function expectResult(code: string, options: TestOptions = {}) {
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

export async function expectNativeToTimeoutAndError(code: string, timeout: number) {
  const start = Date.now()
  const context = mockContext(Chapter.SOURCE_4)
  const promise = runInContext(code, context, {
    executionMethod: 'native',
    throwInfiniteLoops: false
  })
  await promise
  const timeTaken = Date.now() - start
  expect(timeTaken).toBeLessThan(timeout * 5)
  expect(timeTaken).toBeGreaterThanOrEqual(timeout)
  return parseError(context.errors)
}

export async function snapshotSuccess(code: string, options: TestOptions = {}) {
  const results = await testSuccess(code, options)
  expect(results).toMatchSnapshot()
  return results
}

export async function snapshotFailure(code: string, options: TestOptions = {}) {
  const results = await testFailure(code, options)
  expect(results).toMatchSnapshot()
  return results
}

export function expectDisplayResult(code: string, options: TestOptions = {}) {
  return expect(testSuccess(code, options).then(({ context: { displayResult } }) => displayResult))
    .resolves
}
