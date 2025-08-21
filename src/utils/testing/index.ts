import { assert, expect, it, test } from 'vitest'
import { parseError, runInContext } from '../..'
import createContext, { defineBuiltin } from '../../createContext'
import { Chapter, Variant } from '../../langs'
import type { Context, CustomBuiltIns } from '../../types'
import { getChapterName } from '../misc'
import { mockContext } from './mocks'
import type { TestBuiltins, TestContext, TestOptions, TestResults } from './types'

export const contextIt = it.extend<{
  chapter: Chapter
  variant: Variant
  context: Context
}>({
  chapter: Chapter.SOURCE_1,
  variant: Variant.DEFAULT,
  context: ({ chapter, variant }, use) => use(mockContext(chapter, variant))
})

export const contextTest = test.extend<{
  chapter: Chapter
  variant: Variant
  context: Context
}>({
  chapter: Chapter.SOURCE_1,
  variant: Variant.DEFAULT,
  context: ({ chapter, variant }, use) => use(mockContext(chapter, variant))
})

export function createTestContext(rawOptions: TestOptions = {}): TestContext {
  const { chapter, variant, testBuiltins, languageOptions }: Exclude<TestOptions, Chapter> =
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

  const evalContext = createContext(
    chapter,
    variant,
    languageOptions,
    [],
    undefined,
    customBuiltIns
  )
  Object.entries(testBuiltins ?? {}).forEach(([key, value]) =>
    defineBuiltin(evalContext, key, value)
  )

  return {
    ...evalContext,
    ...otherTestResults
  }
}

/**
 * Convert the options provided by the user for each test into the full options
 * used by the testing system
 */
export function processTestOptions(rawOptions: TestOptions): Exclude<TestOptions, Chapter> {
  return typeof rawOptions === 'number'
    ? {
        chapter: rawOptions
      }
    : rawOptions
}

/**
 * Convenience wrapper for testing a case with multiple chapters
 */
export function testWithChapters(...chapters: Chapter[]) {
  return (func: (chapter: Chapter) => any) =>
    test.each(chapters.map(chapter => [getChapterName(chapter), chapter]))(
      'Testing %s',
      (_, chapter) => func(chapter)
    )
}

export async function testInContext(code: string, rawOptions: TestOptions) {
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

  assert(result.status === 'finished')
  return {
    context,
    result
  }
}

export async function testForValue(code: string, options: TestOptions = {}) {
  const { result } = await testSuccess(code, options)
  return result.value
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
 * Calls `eval` on the provided code with the provided builtins
 */
export function evalWithBuiltins(code: string, testBuiltins: TestBuiltins = {}) {
  // Ugly, but if you know how to `eval` code with some builtins attached, please change this.
  const builtins = Object.keys(testBuiltins).map(key => `const ${key} = testBuiltins.${key};`)
  const evalstring = builtins.join('\n') + code

  // tslint:disable-next-line:no-eval
  return eval(evalstring + code)
}
