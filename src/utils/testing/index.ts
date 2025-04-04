import { Chapter, type CustomBuiltIns } from '../../types'
import { parseError, runInContext } from '../..'
import createContext, { defineBuiltin } from '../../createContext'
import { assertIsFinished, processTestOptions } from './misc'
import { mockContext } from './mocks'
import type { TestContext, TestOptions, TestResults } from './types'

export function createTestContext(rawOptions: TestOptions = {}): TestContext {
  const { chapter, variant, testBuiltins }: Exclude<TestOptions, Chapter> =
    typeof rawOptions === 'number'
      ? {
          chapter: rawOptions
        }
      : rawOptions

  const otherTestResults: TestResults = {
    displayResult: [],
    promptResult: [],
    alertResult: [],
    visualiseListResult: []
  }

  const customBuiltIns: CustomBuiltIns = {
    rawDisplay(str1, str2, _externalContext) {
      otherTestResults.displayResult.push((str2 === undefined ? '' : str2 + ' ') + str1)
      return str1
    },
    prompt(str, _externalContext) {
      otherTestResults.promptResult.push(str)
      return null
    },
    alert(str, _externalContext) {
      otherTestResults.alertResult.push(str)
    },
    visualiseList(value) {
      otherTestResults.visualiseListResult.push(value)
    }
  }

  const evalContext = createContext(chapter, variant, [], undefined, customBuiltIns)
  Object.entries(testBuiltins ?? {}).forEach(([key, value]) =>
    defineBuiltin(evalContext, key, value)
  )

  return {
    ...evalContext,
    ...otherTestResults
  }
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

  assertIsFinished(result)
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
export function expectFinishedResult(code: string, options: TestOptions = {}) {
  return expect(
    testInContext(code, options).then(({ result, context }) => {
      if (result.status === 'error') {
        console.log(context.errors)
      }
      assertIsFinished(result)
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
  await runInContext(code, context, {
    executionMethod: 'native',
    throwInfiniteLoops: false
  })
  const timeTaken = Date.now() - start
  expect(timeTaken).toBeLessThan(timeout * 5)
  expect(timeTaken).toBeGreaterThanOrEqual(timeout)
  return parseError(context.errors)
}

/**
 * Run the given code, expect it to finish without errors and also match a snapshot
 */
export async function snapshotSuccess(code: string, options: TestOptions = {}, name?: string) {
  const results = await testSuccess(code, options)
  expect(results).toMatchSnapshot(name)
  return results
}

/**
 * Run the given code, expect it to finish with errors and that those errors match a snapshot
 */
export async function snapshotFailure(code: string, options: TestOptions = {}, name?: string) {
  const results = await testFailure(code, options)
  expect(results).toMatchSnapshot(name)
  return results
}

export function expectDisplayResult(code: string, options: TestOptions = {}) {
  return expect(testSuccess(code, options).then(({ context: { displayResult } }) => displayResult))
    .resolves
}
