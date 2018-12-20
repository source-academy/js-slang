export { stripIndent, oneLine } from 'common-tags'

import { default as createContext, defineBuiltin } from '../createContext'
import { parseError, runInContext } from '../index'
import { Context, CustomBuiltIns, Finished, Result, Value } from '../types'

export interface TestContext extends Context {
  displayResult?: string
  promptResult?: string
  alertResult?: string
  visualiseListResult?: Value[]
}

interface TestBuiltins {
  // tslint:disable-next-line:ban-types
  [funcName: string]: Function
}

function createTestContext(
  chapter: number | TestContext = 1,
  testBuiltins?: TestBuiltins
): TestContext {
  if (chapter === undefined) {
    chapter = 1
  }

  if (typeof chapter === 'number') {
    const context: TestContext = createContext(chapter, [], undefined, {
      rawDisplay: (str, externalContext) => {
        context.displayResult = context.displayResult ? context.displayResult + '\n' + str : str
        return str
      },
      prompt: (str, externalContext) => {
        context.promptResult = context.promptResult ? context.promptResult + '\n' + str : str
        return null
      },
      alert: (str, externalContext) => {
        context.alertResult = context.alertResult ? context.alertResult + '\n' + str : str
      },
      visualiseList: value => {
        if (context.visualiseListResult !== undefined) {
          context.visualiseListResult.push(value)
        } else {
          context.visualiseListResult = [value]
        }
      }
    } as CustomBuiltIns)

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

function expectSuccess(code: string, testContext: TestContext, result: Result) {
  expect(testContext.errors).toEqual([])
  expect(result.status).toBe('finished')
  expect({
    code,
    displayResult: testContext.displayResult,
    alertResult: testContext.alertResult,
    visualiseListResult: testContext.visualiseListResult,
    result: (result as Finished).value
  }).toMatchSnapshot()
}

function expectFailure(code: string, testContext: TestContext, result: Result) {
  expect(testContext.errors).not.toEqual([])
  expect(result.status).toBe('error')
  expect({
    code,
    displayResult: testContext.displayResult,
    alertResult: testContext.alertResult,
    visualiseListResult: testContext.visualiseListResult,
    error: parseError(testContext.errors)
  }).toMatchSnapshot()
}

function expectSuccessWithWarnings(code: string, testContext: TestContext, result: Result) {
  expect(testContext.errors).not.toEqual([])
  expect(result.status).toBe('finished')
  expect({
    code,
    displayResult: testContext.displayResult,
    alertResult: testContext.alertResult,
    visualiseListResult: testContext.visualiseListResult,
    result: (result as Finished).value
  }).toMatchSnapshot()
}

function expectFailureNoSnapshot(code: string, testContext: TestContext, result: Result) {
  expect(testContext.errors).not.toEqual([])
  expect(result.status).toBe('error')
}

export function expectDisplayResult(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  const testContext = createTestContext(chapterOrContext, testBuiltins)
  const scheduler = 'preemptive'
  return expect(
    runInContext(code, testContext, { scheduler }).then(result => {
      expectSuccess(code, testContext, result)
      return testContext.displayResult!
    })
  ).resolves
}

export function expectResult(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  const testContext = createTestContext(chapterOrContext, testBuiltins)
  const scheduler = 'preemptive'
  return expect(
    runInContext(code, testContext, { scheduler }).then(result => {
      expectSuccess(code, testContext, result)
      return (result as Finished).value
    })
  ).resolves
}

export function expectError(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  const testContext = createTestContext(chapterOrContext, testBuiltins)
  const scheduler = 'preemptive'
  return expect(
    runInContext(code, testContext, { scheduler }).then(result => {
      expectFailure(code, testContext, result)
      return parseError(testContext.errors)
    })
  ).resolves
}

export function expectWarning(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  const testContext = createTestContext(chapterOrContext, testBuiltins)
  const scheduler = 'preemptive'
  return expect(
    runInContext(code, testContext, { scheduler }).then(result => {
      expectSuccessWithWarnings(code, testContext, result)
      return parseError(testContext.errors)
    })
  ).resolves
}

export function expectErrorNoSnapshot(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  const testContext = createTestContext(chapterOrContext, testBuiltins)
  const scheduler = 'preemptive'
  return expect(
    runInContext(code, testContext, { scheduler }).then(result => {
      expectFailureNoSnapshot(code, testContext, result)
      return parseError(testContext.errors)
    })
  ).resolves
}

export function snapshotSuccess(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  const testContext = createTestContext(chapterOrContext, testBuiltins)
  const scheduler = 'preemptive'
  return runInContext(code, testContext, { scheduler }).then(result => {
    expectSuccess(code, testContext, result)
  })
}

export function snapshotFailure(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  const testContext = createTestContext(chapterOrContext, testBuiltins)
  const scheduler = 'preemptive'
  return runInContext(code, testContext, { scheduler }).then(result => {
    expectFailure(code, testContext, result)
  })
}

export function expectToMatchJS(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  // tslint:disable-next-line:no-eval
  return expectResult(code, chapterOrContext, testBuiltins).toEqual(eval(code))
}

export function expectToLooselyMatchJS(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  const testContext = createTestContext(chapterOrContext, testBuiltins)
  const scheduler = 'preemptive'
  return runInContext(code, testContext, { scheduler }).then(result => {
    expectSuccess(code, testContext, result)
    // tslint:disable-next-line:no-eval
    expect((result as Finished).value.replace(/ /g, '')).toEqual(eval(code).replace(/ /g, ''))
  })
}
