export { stripIndent, oneLine } from 'common-tags'

import { default as createContext, defineBuiltin } from '../createContext'
import { parseError, runInContext } from '../index'
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

function createTestContext(
  chapter: number | TestContext = 1,
  testBuiltins?: TestBuiltins
): TestContext {
  if (chapter === undefined) {
    chapter = 1
  }

  if (typeof chapter === 'number') {
    const context: TestContext = {
      ...createContext(chapter, [], undefined, {
        rawDisplay: (str, externalContext) => {
          context.displayResult.push(str)
          return str
        },
        prompt: (str, externalContext) => {
          context.promptResult.push(str)
          return null
        },
        alert: (str, externalContext) => {
          context.alertResult.push(str)
        },
        visualiseList: value => {
          context.visualiseListResult.push(value)
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
          defineBuiltin(context, name, testBuiltins[name])
        }
      }
    }

    return context
  } else {
    return chapter
  }
}

function testInContext(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
): Promise<TestResult> {
  const testContext = createTestContext(chapterOrContext, testBuiltins)
  const scheduler = 'preemptive'
  return runInContext(code, testContext, { scheduler }).then(result => {
    return {
      code,
      displayResult: testContext.displayResult,
      alertResult: testContext.alertResult,
      visualiseListResult: testContext.visualiseListResult,
      errors: testContext.errors,
      parsedErrors: parseError(testContext.errors),
      resultStatus: result.status,
      result: result.status === 'finished' ? result.value : undefined
    }
  })
}

export function testSuccess(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return testInContext(code, chapterOrContext, testBuiltins).then(testResult => {
    expect(testResult.errors).toEqual([])
    expect(testResult.resultStatus).toBe('finished')
    return testResult
  })
}

export function testSuccessWithErrors(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return testInContext(code, chapterOrContext, testBuiltins).then(testResult => {
    expect(testResult.errors).not.toEqual([])
    expect(testResult.resultStatus).toBe('finished')
    return testResult
  })
}

export function testFailure(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return testInContext(code, chapterOrContext, testBuiltins).then(testResult => {
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

export function snapshotSuccess(
  code: string,
  chapterOrContext?: number | TestContext,
  snapshotName?: string,
  testBuiltins?: TestBuiltins
) {
  return testSuccess(code, chapterOrContext, testBuiltins).then(snapshot(snapshotName))
}

export function snapshotWarning(
  code: string,
  chapterOrContext?: number | TestContext,
  snapshotName?: string,
  testBuiltins?: TestBuiltins
) {
  return testSuccessWithErrors(code, chapterOrContext, testBuiltins).then(snapshot(snapshotName))
}

export function snapshotFailure(
  code: string,
  chapterOrContext?: number | TestContext,
  snapshotName?: string,
  testBuiltins?: TestBuiltins
) {
  return testFailure(code, chapterOrContext, testBuiltins).then(snapshot(snapshotName))
}

export function expectDisplayResult(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return expect(
    testSuccess(code, chapterOrContext, testBuiltins)
      .then(snapshot('expectDisplayResult'))
      .then(testResult => testResult.displayResult!)
  ).resolves
}

export function expectResult(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return expect(
    testSuccess(code, chapterOrContext, testBuiltins)
      .then(snapshot('expectResult'))
      .then(testResult => testResult.result)
  ).resolves
}

export function expectParsedErrorNoErrorSnapshot(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return expect(
    testFailure(code, chapterOrContext, testBuiltins)
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

export function expectParsedError(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return expect(
    testFailure(code, chapterOrContext, testBuiltins)
      .then(snapshot('expectParsedError'))
      .then(testResult => testResult.parsedErrors)
  ).resolves
}

export function expectWarning(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return expect(
    testSuccessWithErrors(code, chapterOrContext, testBuiltins)
      .then(snapshot('expectWarning'))
      .then(testResult => testResult.parsedErrors)
  ).resolves
}

export function expectParsedErrorNoSnapshot(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return expect(
    testFailure(code, chapterOrContext, testBuiltins).then(testResult => testResult.parsedErrors)
  ).resolves
}

export function expectToMatchJS(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return (
    testSuccess(code, chapterOrContext, testBuiltins)
      .then(snapshot('expect to match JS'))
      // tslint:disable-next-line:no-eval
      .then(testResult => expect(testResult.result).toEqual(eval(code)))
  )
}

export function expectToLooselyMatchJS(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return testSuccess(code, chapterOrContext, testBuiltins)
    .then(snapshot('expect to loosely match JS'))
    .then(testResult =>
      // tslint:disable-next-line:no-eval
      expect(testResult.result.replace(/ /g, '')).toEqual(eval(code).replace(/ /g, ''))
    )
}
