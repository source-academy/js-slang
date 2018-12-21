export { stripIndent, oneLine } from 'common-tags'

import { default as createContext, defineBuiltin } from '../createContext'
import { parseError, runInContext } from '../index'
import { Context, CustomBuiltIns, Finished, Value } from '../types'

export interface TestContext extends Context {
  displayResult?: string
  promptResult?: string
  alertResult?: string
  visualiseListResult?: Value[]
}

interface TestBuiltins {
  [builtinName: string]: any
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

function testInContext(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  const testContext = createTestContext(chapterOrContext, testBuiltins)
  const scheduler = 'preemptive'
  return runInContext(code, testContext, { scheduler }).then(result => {
    return {
      code,
      displayResult: testContext.displayResult,
      alertResult: testContext.alertResult,
      visualiseListResult: testContext.visualiseListResult,
      errors: testContext.errors,
      result
    }
  })
}

export function expectDisplayResult(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return expect(
    testInContext(code, chapterOrContext, testBuiltins).then(testResult => {
      expect(testResult.errors).toEqual([])
      expect(testResult.result.status).toBe('finished')
      expect({
        code: testResult.code,
        displayResult: testResult.displayResult,
        alertResult: testResult.alertResult,
        visualiseListResult: testResult.visualiseListResult,
        result: (testResult.result as Finished).value
      }).toMatchSnapshot()
      return testResult.displayResult!
    })
  ).resolves
}

export function expectResult(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return expect(
    testInContext(code, chapterOrContext, testBuiltins).then(testResult => {
      expect(testResult.errors).toEqual([])
      expect(testResult.result.status).toBe('finished')
      expect({
        code: testResult.code,
        displayResult: testResult.displayResult,
        alertResult: testResult.alertResult,
        visualiseListResult: testResult.visualiseListResult,
        result: (testResult.result as Finished).value
      }).toMatchSnapshot()
      return (testResult.result as Finished).value
    })
  ).resolves
}

export function expectError(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return expect(
    testInContext(code, chapterOrContext, testBuiltins).then(testResult => {
      expect(testResult.errors).not.toEqual([])
      expect(testResult.result.status).toBe('error')
      expect({
        code: testResult.code,
        displayResult: testResult.displayResult,
        alertResult: testResult.alertResult,
        visualiseListResult: testResult.visualiseListResult,
        error: parseError(testResult.errors)
      }).toMatchSnapshot()
      return parseError(testResult.errors)
    })
  ).resolves
}

export function expectWarning(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return expect(
    testInContext(code, chapterOrContext, testBuiltins).then(testResult => {
      expect(testResult.errors).not.toEqual([])
      expect(testResult.result.status).toBe('finished')
      expect({
        code: testResult.code,
        displayResult: testResult.displayResult,
        alertResult: testResult.alertResult,
        visualiseListResult: testResult.visualiseListResult,
        result: (testResult.result as Finished).value
      }).toMatchSnapshot()
      return parseError(testResult.errors)
    })
  ).resolves
}

export function expectErrorNoSnapshot(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return expect(
    testInContext(code, chapterOrContext, testBuiltins).then(testResult => {
      expect(testResult.errors).not.toEqual([])
      expect(testResult.result.status).toBe('error')
      return parseError(testResult.errors)
    })
  ).resolves
}

export function snapshotSuccess(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return testInContext(code, chapterOrContext, testBuiltins).then(testResult => {
    expect(testResult.errors).toEqual([])
    expect(testResult.result.status).toBe('finished')
    expect({
      code: testResult.code,
      displayResult: testResult.displayResult,
      alertResult: testResult.alertResult,
      visualiseListResult: testResult.visualiseListResult,
      result: (testResult.result as Finished).value
    }).toMatchSnapshot()
  })
}

export function snapshotFailure(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return testInContext(code, chapterOrContext, testBuiltins).then(testResult => {
    expect(testResult.errors).not.toEqual([])
    expect(testResult.result.status).toBe('error')
    expect({
      code,
      displayResult: testResult.displayResult,
      alertResult: testResult.alertResult,
      visualiseListResult: testResult.visualiseListResult,
      error: parseError(testResult.errors)
    }).toMatchSnapshot()
  })
}

export function expectToMatchJS(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return testInContext(code, chapterOrContext, testBuiltins).then(testResult => {
    expect(testResult.errors).toEqual([])
    expect(testResult.result.status).toBe('finished')
    expect({
      code: testResult.code,
      displayResult: testResult.displayResult,
      alertResult: testResult.alertResult,
      visualiseListResult: testResult.visualiseListResult,
      result: (testResult.result as Finished).value
    }).toMatchSnapshot()
    // tslint:disable-next-line:no-eval
    expect((testResult.result as Finished).value).toEqual(eval(code))
  })
}

export function expectToLooselyMatchJS(
  code: string,
  chapterOrContext?: number | TestContext,
  testBuiltins?: TestBuiltins
) {
  return testInContext(code, chapterOrContext, testBuiltins).then(testResult => {
    expect(testResult.errors).toEqual([])
    expect(testResult.result.status).toBe('finished')
    expect({
      code: testResult.code,
      displayResult: testResult.displayResult,
      alertResult: testResult.alertResult,
      visualiseListResult: testResult.visualiseListResult,
      result: (testResult.result as Finished).value
    }).toMatchSnapshot()
    expect((testResult.result as Finished).value.replace(/ /g, '')).toEqual(
      // tslint:disable-next-line:no-eval
      eval(code).replace(/ /g, '')
    )
  })
}
