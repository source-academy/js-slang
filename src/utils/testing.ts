import { generate } from 'astring'

import { default as createContext, defineBuiltin } from '../createContext'
import { transpileToGPU } from '../gpu/gpu'
import { parseError, Result, runInContext } from '../index'
import { transpileToLazy } from '../lazy/lazy'
import { mockContext } from '../mocks/context'
import { ImportTransformOptions } from '../modules/moduleTypes'
import { parse } from '../parser/parser'
import { transpile } from '../transpiler/transpiler'
import { Chapter, Context, CustomBuiltIns, SourceError, Value, Variant } from '../types'
import { stringify } from './stringify'

export interface CodeSnippetTestCase {
  name: string
  snippet: string
  value: any
  errors: SourceError[]
}

export interface TestContext extends Context {
  displayResult: string[]
  promptResult: string[]
  alertResult: string[]
  visualiseListResult: Value[]
}

interface TestBuiltins {
  [builtinName: string]: any
}

interface TestResult {
  code: string
  displayResult: string[]
  alertResult: string[]
  visualiseListResult: any[]
  errors?: SourceError[]
  numErrors: number
  parsedErrors: string
  resultStatus: string
  result: Value
}

interface TestOptions {
  context?: TestContext
  chapter?: Chapter
  variant?: Variant
  testBuiltins?: TestBuiltins
  native?: boolean
  showTranspiledCode?: boolean
  showErrorJSON?: boolean
  importOptions?: Partial<ImportTransformOptions>
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

async function testInContext(code: string, options: TestOptions): Promise<TestResult> {
  const interpretedTestContext = createTestContext(options)
  const scheduler = 'preemptive'
  const getTestResult = (context: TestContext, result: Result) => {
    const testResult = {
      code,
      displayResult: context.displayResult,
      alertResult: context.alertResult,
      visualiseListResult: context.visualiseListResult,
      numErrors: context.errors.length,
      parsedErrors: parseError(context.errors),
      resultStatus: result.status,
      result: result.status === 'finished' ? result.value : undefined
    }
    if (options.showErrorJSON) {
      testResult['errors'] = context.errors
    }
    return testResult
  }
  const interpretedResult = getTestResult(
    interpretedTestContext,
    await runInContext(code, interpretedTestContext, {
      scheduler,
      executionMethod: 'interpreter',
      variant: options.variant
    })
  )
  if (options.native) {
    const nativeTestContext = createTestContext(options)
    let pretranspiled: string = ''
    let transpiled: string = ''
    const parsed = parse(code, nativeTestContext)!
    // Reset errors in context so as not to interfere with actual run.
    nativeTestContext.errors = []
    if (parsed === undefined) {
      pretranspiled = 'parseError'
    } else {
      // Mutates program
      switch (options.variant) {
        case Variant.GPU:
          transpileToGPU(parsed)
          pretranspiled = generate(parsed)
          break
        case Variant.LAZY:
          transpileToLazy(parsed)
          pretranspiled = generate(parsed)
          break
      }
      try {
        ;({ transpiled } = await transpile(parsed, nativeTestContext, options.importOptions))
        // replace declaration of builtins since they're repetitive
        transpiled = transpiled.replace(/\n  const \w+ = nativeStorage\..*;/g, '')
        transpiled = transpiled.replace(/\n\s*const \w+ = .*\.operators\..*;/g, '')
      } catch {
        transpiled = 'parseError'
      }
    }
    const nativeResult = getTestResult(
      nativeTestContext,
      await runInContext(code, nativeTestContext, {
        scheduler,
        executionMethod: 'native',
        variant: options.variant
      })
    )
    const propertiesThatShouldBeEqual = [
      'code',
      'displayResult',
      'alertResult',
      'parsedErrors',
      'result'
    ]
    const diff = {}
    for (const property of propertiesThatShouldBeEqual) {
      const nativeValue = stringify(nativeResult[property])
      const interpretedValue = stringify(interpretedResult[property])
      if (nativeValue !== interpretedValue) {
        diff[property] = `native:${nativeValue}\ninterpreted:${interpretedValue}`
      }
    }
    if (options.showTranspiledCode) {
      return { ...interpretedResult, ...diff, pretranspiled, transpiled } as TestResult
    } else {
      return { ...interpretedResult, ...diff } as TestResult
    }
  } else {
    return interpretedResult
  }
}

export async function testSuccess(code: string, options: TestOptions = { native: false }) {
  const testResult = await testInContext(code, options)
  expect(testResult.parsedErrors).toBe('')
  expect(testResult.resultStatus).toBe('finished')
  return testResult
}

export async function testSuccessWithErrors(
  code: string,
  options: TestOptions = { native: false }
) {
  const testResult = await testInContext(code, options)
  expect(testResult.numErrors).not.toEqual(0)
  expect(testResult.resultStatus).toBe('finished')
  return testResult
}

export async function testFailure(code: string, options: TestOptions = { native: false }) {
  const testResult = await testInContext(code, options)
  expect(testResult.numErrors).not.toEqual(0)
  expect(testResult.resultStatus).toBe('error')
  return testResult
}

export function snapshot<T extends { [P in keyof TestResult]: any }>(
  propertyMatchers: Partial<T>,
  snapshotName?: string
): (testResult: TestResult) => TestResult
export function snapshot(
  snapshotName?: string,
  arg2?: string
): (testResult: TestResult) => TestResult
export function snapshot(arg1?: any, arg2?: any): (testResult: TestResult) => TestResult {
  if (arg2) {
    return testResult => {
      expect(testResult).toMatchSnapshot(arg1!, arg2)
      return testResult
    }
  } else if (arg1) {
    return testResult => {
      expect(testResult).toMatchSnapshot(arg1!)
      return testResult
    }
  } else {
    return testResult => {
      return testResult
    }
  }
}

export function snapshotSuccess(code: string, options: TestOptions, snapshotName?: string) {
  return testSuccess(code, options).then(snapshot(snapshotName))
}

export function snapshotWarning(code: string, options: TestOptions, snapshotName: string) {
  return testSuccessWithErrors(code, options).then(snapshot(snapshotName))
}

export function snapshotFailure(code: string, options: TestOptions, snapshotName: string) {
  return testFailure(code, options).then(snapshot(snapshotName))
}

export function expectDisplayResult(code: string, options: TestOptions = {}) {
  return expect(
    testSuccess(code, options)
      .then(snapshot('expectDisplayResult'))
      .then(testResult => testResult.displayResult!)
      .catch(e => console.log(e))
  ).resolves
}

export function expectVisualiseListResult(code: string, options: TestOptions = {}) {
  return expect(
    testSuccess(code, options)
      .then(snapshot('expectVisualiseListResult'))
      .then(testResult => testResult.visualiseListResult)
      .catch(e => console.log(e))
  ).resolves
}

// for use in concurrent testing
export async function getDisplayResult(code: string, options: TestOptions = {}) {
  return await testSuccess(code, options).then(testResult => testResult.displayResult!)
}

export function expectResult(code: string, options: TestOptions = {}) {
  return expect(
    testSuccess(code, options)
      .then(snapshot('expectResult'))
      .then(testResult => testResult.result)
  ).resolves
}

export function expectParsedErrorNoErrorSnapshot(code: string, options: TestOptions = {}) {
  options.showErrorJSON = false
  return expect(
    testFailure(code, options)
      .then(snapshot('expectParsedErrorNoErrorSnapshot'))
      .then(testResult => testResult.parsedErrors)
  ).resolves
}

export function expectParsedError(code: string, options: TestOptions = {}) {
  return expect(
    testFailure(code, options)
      .then(snapshot('expectParsedError'))
      .then(testResult => testResult.parsedErrors)
  ).resolves
}

export function expectDifferentParsedErrors(
  code1: string,
  code2: string,
  options: TestOptions = {}
) {
  return expect(
    testFailure(code1, options).then(error1 => {
      expect(
        testFailure(code2, options).then(error2 => {
          return expect(error1).not.toEqual(error2)
        })
      )
    })
  ).resolves
}

export function expectWarning(code: string, options: TestOptions = {}) {
  return expect(
    testSuccessWithErrors(code, options)
      .then(snapshot('expectWarning'))
      .then(testResult => testResult.parsedErrors)
  ).resolves
}

export function expectParsedErrorNoSnapshot(code: string, options: TestOptions = {}) {
  return expect(testFailure(code, options).then(testResult => testResult.parsedErrors)).resolves
}

function evalWithBuiltins(code: string, testBuiltins: TestBuiltins = {}) {
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

export function expectToMatchJS(code: string, options: TestOptions = {}) {
  return testSuccess(code, options)
    .then(snapshot('expect to match JS'))
    .then(testResult =>
      expect(testResult.result).toEqual(evalWithBuiltins(code, options.testBuiltins))
    )
}

export function expectToLooselyMatchJS(code: string, options: TestOptions = {}) {
  return testSuccess(code, options)
    .then(snapshot('expect to loosely match JS'))
    .then(testResult =>
      expect(testResult.result.replace(/ /g, '')).toEqual(
        evalWithBuiltins(code, options.testBuiltins).replace(/ /g, '')
      )
    )
}

export async function expectNativeToTimeoutAndError(code: string, timeout: number) {
  const start = Date.now()
  const context = mockContext(Chapter.SOURCE_4)
  const promise = runInContext(code, context, {
    scheduler: 'preemptive',
    executionMethod: 'native',
    throwInfiniteLoops: false
  })
  await promise
  const timeTaken = Date.now() - start
  expect(timeTaken).toBeLessThan(timeout * 5)
  expect(timeTaken).toBeGreaterThanOrEqual(timeout)
  return parseError(context.errors)
}
