export { stripIndent, oneLine } from 'common-tags'

import createContext from '../createContext'
import { runInContext } from '../index'
import { Context, CustomBuiltIns, Finished, Result, Value } from '../types'

export interface TestContext extends Context {
  displayResult?: string
  promptResult?: string
  alertResult?: string
  visualiseListResult?: Value[]
}

function createTestContext(chapter: number | TestContext = 1): TestContext {
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
    return context
  } else {
    return chapter
  }
}

function expectSuccess(code: string, testContext: TestContext, result: Result) {
  expect(testContext.errors).toEqual([])
  expect(result.status).toBe('finished')
  expect({
    code: code,
    displayResult: testContext.displayResult,
    alertResult: testContext.alertResult,
    visualiseListResult: testContext.visualiseListResult,
    result: (result as Finished).value
  }).toMatchSnapshot()
}

export function expectDisplayResult(code: string, chapterOrContext?: number | TestContext) {
  const testContext = createTestContext(chapterOrContext)
  const scheduler = 'preemptive'
  return expect(
    runInContext(code, testContext, { scheduler }).then(result => {
      expectSuccess(code, testContext, result)
      return testContext.displayResult!
    })
  ).resolves
}

export function expectResult(code: string, chapterOrContext?: number | TestContext) {
  const testContext = createTestContext(chapterOrContext)
  const scheduler = 'preemptive'
  return expect(
    runInContext(code, testContext, { scheduler }).then(result => {
      expectSuccess(code, testContext, result)
      return (result as Finished).value
    })
  ).resolves
}

export function snapshotExecution(code: string, chapterOrContext?: number | TestContext) {
  const testContext = createTestContext(chapterOrContext)
  const scheduler = 'preemptive'
  return runInContext(code, testContext, { scheduler }).then(result => {
    expectSuccess(code, testContext, result)
  })
}
