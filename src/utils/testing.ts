export { stripIndent, oneLine } from 'common-tags'

import { default as createContext, defineBuiltin } from '../createContext'
import { parseError, runInContext } from '../index'
import { stringify } from '../interop'
import { parse } from '../parser'
import { transpile } from '../transpiler'
import { Context, CustomBuiltIns, SourceError, Value } from '../types'

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

function createTestContext({
  context,
  chapter = 1,
  testBuiltins
}: { context?: TestContext; chapter?: number; testBuiltins?: TestBuiltins } = {}): TestContext {
  if (context !== undefined) {
    return context
  } else {
    const testContext: TestContext = {
      ...createContext(chapter, [], undefined, {
        rawDisplay: (str, externalContext) => {
          testContext.displayResult.push(str)
          return str
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

    if (testBuiltins !== undefined) {
      for (const name in testBuiltins) {
        if (testBuiltins.hasOwnProperty(name)) {
          defineBuiltin(testContext, name, testBuiltins[name])
        }
      }
    }

    return testContext
  }
}

function testInContext(code: string, options: TestOptions): Promise<TestResult> {
  const interpretedTestContext = createTestContext(options)
  const scheduler = 'preemptive'
  const interpreted = runInContext(code, interpretedTestContext, {
    scheduler,
    isNativeRunnable: false
  }).then(result => {
    return {
      code,
      displayResult: interpretedTestContext.displayResult,
      alertResult: interpretedTestContext.alertResult,
      visualiseListResult: interpretedTestContext.visualiseListResult,
      errors: interpretedTestContext.errors,
      parsedErrors: parseError(interpretedTestContext.errors),
      resultStatus: result.status,
      result: result.status === 'finished' ? result.value : undefined
    }
  })
  if (options.native) {
    const nativeTestContext = createTestContext(options)
    return interpreted.then(interpretedResult => {
      return runInContext(code, nativeTestContext, { scheduler, isNativeRunnable: true }).then(
        result => {
          const isInterpretedFinished = interpretedResult.resultStatus === 'finished'
          const transpilerContext = createTestContext(options)
          const transpiled = isInterpretedFinished
            ? transpile(parse(code, transpilerContext)!, transpilerContext.contextId).transpiled
            : 'parseError'
          // replace native[<number>] as they may be inconsistent
          const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
          // replace the line hiding globals as they may differ between environments
          const replacedGlobalsLine = replacedNative.replace(
            /\n\(\(.*\)/,
            '\n(( <globals redacted> )'
          )
          // replace declaration of builtins since they're repetitive
          const replacedBuiltins = replacedGlobalsLine.replace(
            /\n *const \w+ = native\.builtins\.get\("\w+"\);/g,
            ''
          )
          const nativeResult = {
            code,
            displayResult: nativeTestContext.displayResult,
            alertResult: nativeTestContext.alertResult,
            visualiseListResult: nativeTestContext.visualiseListResult,
            errors: nativeTestContext.errors,
            parsedErrors: parseError(nativeTestContext.errors),
            resultStatus: result.status,
            result: result.status === 'finished' ? result.value : undefined
          }
          const propertiesThatShouldBeEqual = [
            'code',
            'displayResult',
            'alertResult',
            'parsedErrors',
            'result'
          ]
          const diff = propertiesThatShouldBeEqual
            .filter(
              property =>
                stringify(nativeResult[property]) !== stringify(interpretedResult[property])
            )
            .reduce(
              (acc: object, curr: string) => ({
                ...acc,
                [curr]: `native:${stringify(nativeResult[curr])}\ninterpreted:${stringify(
                  interpretedResult[curr]
                )}`
              }),
              {}
            )
          return { ...interpretedResult, ...diff, transpiled: replacedBuiltins } as TestResult
        }
      )
    })
  } else {
    return interpreted
  }
}

export function testSuccess(code: string, options: TestOptions = { native: false }) {
  return testInContext(code, options).then(testResult => {
    expect(testResult.errors).toEqual([])
    expect(testResult.resultStatus).toBe('finished')
    return testResult
  })
}

export function testSuccessWithErrors(code: string, options: TestOptions = { native: false }) {
  return testInContext(code, options).then(testResult => {
    expect(testResult.errors).not.toEqual([])
    expect(testResult.resultStatus).toBe('finished')
    return testResult
  })
}

export function testFailure(code: string, options: TestOptions = { native: false }) {
  return testInContext(code, options).then(testResult => {
    expect(testResult.errors).not.toEqual([])
    expect(testResult.resultStatus).toBe('error')
    return testResult
  })
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
