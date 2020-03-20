import { default as createContext, defineBuiltin } from '../createContext'
import { parseError, Result, runInContext } from '../index'
import { mockContext } from '../mocks/context'
import { parse } from '../parser/parser'
import { transpile } from '../transpiler/transpiler'
import { Context, CustomBuiltIns, SourceError, Value } from '../types'
import { stringify } from './stringify'

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
  errors: SourceError[]
  parsedErrors: string
  resultStatus: string
  result: Value
}

interface TestOptions {
  context?: TestContext
  chapter?: number
  testBuiltins?: TestBuiltins
  native?: boolean
}

export function createTestContext({
  context,
  chapter = 1,
  testBuiltins = {}
}: { context?: TestContext; chapter?: number; testBuiltins?: TestBuiltins } = {}): TestContext {
  if (context !== undefined) {
    return context
  } else {
    const testContext: TestContext = {
      ...createContext(chapter, [], undefined, {
        rawDisplay: (str1, str2, externalContext) => {
          testContext.displayResult.push((str2 === undefined ? '' : str2 + ' ') + str1)
          return str1
        },
        prompt: (str, externalContext) => {
          testContext.promptResult.push(str)
          return null
        },
        alert: (str, externalContext) => {
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
  const getTestResult = (context: TestContext, result: Result) => ({
    code,
    displayResult: context.displayResult,
    alertResult: context.alertResult,
    visualiseListResult: context.visualiseListResult,
    errors: context.errors,
    parsedErrors: parseError(context.errors),
    resultStatus: result.status,
    result: result.status === 'finished' ? result.value : undefined
  })
  const interpretedResult = getTestResult(
    interpretedTestContext,
    await runInContext(code, interpretedTestContext, {
      scheduler,
      executionMethod: 'interpreter'
    })
  )
  if (options.native) {
    const nativeTestContext = createTestContext(options)
    let transpiled: string
    try {
      const parsed = parse(code, nativeTestContext)!
      transpiled = transpile(parsed, nativeTestContext.contextId, true).transpiled
      // replace native[<number>] as they may be inconsistent
      const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
      // replace the line hiding globals as they may differ between environments
      const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')
      // replace declaration of builtins since they're repetitive
      const replacedBuiltins = replacedGlobalsLine.replace(
        /\n      const \w+ = globals\.(previousScope.)+variables.get\("\w+"\)\.getValue\(\);/g,
        ''
      )
      // replace the line globals = $$NATIVE_STORAGE[xxx].globals to remove [xxx]
      transpiled = replacedBuiltins.replace(/\$\$NATIVE_STORAGE\[\d+]/, '$$NATIVE_STORAGE')
    } catch {
      transpiled = 'parseError'
    }
    const nativeResult = getTestResult(
      nativeTestContext,
      await runInContext(code, nativeTestContext, {
        scheduler,
        executionMethod: 'native'
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
    return { ...interpretedResult, ...diff, transpiled } as TestResult
  } else {
    return interpretedResult
  }
}

export async function testSuccess(code: string, options: TestOptions = { native: false }) {
  const testResult = await testInContext(code, options)
  expect(testResult.errors).toEqual([])
  expect(testResult.resultStatus).toBe('finished')
  return testResult
}

export async function testSuccessWithErrors(
  code: string,
  options: TestOptions = { native: false }
) {
  const testResult = await testInContext(code, options)
  expect(testResult.errors).not.toEqual([])
  expect(testResult.resultStatus).toBe('finished')
  return testResult
}

export async function testFailure(code: string, options: TestOptions = { native: false }) {
  const testResult = await testInContext(code, options)
  expect(testResult.errors).not.toEqual([])
  expect(testResult.resultStatus).toBe('error')
  return testResult
}

export function snapshot<T extends { [P in keyof TestResult]: any }>(
  propertyMatchers: Partial<T>,
  snapshotName?: string
): (testResult: TestResult) => TestResult
export function snapshot<T extends { [P in keyof TestResult]: any }>(
  snapshotName?: string,
  arg2?: string
): (testResult: TestResult) => TestResult
export function snapshot(arg1?: any, arg2?: any): (testResult: TestResult) => TestResult {
  if (arg2) {
    return testResult => {
      expect(testResult).toMatchSnapshot(arg1!, arg2)
      return testResult
    }
  } else {
    return testResult => {
      expect(testResult).toMatchSnapshot(arg1!)
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
  ).resolves
}

export function expectResult(code: string, options: TestOptions = {}) {
  return expect(
    testSuccess(code, options)
      .then(snapshot('expectResult'))
      .then(testResult => testResult.result)
  ).resolves
}

export function expectParsedErrorNoErrorSnapshot(code: string, options: TestOptions = {}) {
  return expect(
    testFailure(code, options)
      .then(
        snapshot(
          {
            errors: expect.any(Array)
          },
          'expectParsedErrorNoErrorSnapshot'
        )
      )
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
  const context = mockContext(4)
  context.prelude = null
  const promise = runInContext(code, context, {
    scheduler: 'preemptive',
    executionMethod: 'native'
  })
  await promise
  const timeTaken = Date.now() - start
  expect(timeTaken).toBeLessThan(timeout * 2)
  expect(timeTaken).toBeGreaterThanOrEqual(timeout)
  return parseError(context.errors)
}
