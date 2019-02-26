import { SourceMapConsumer } from 'source-map'
import { UNKNOWN_LOCATION } from './constants'
import createContext from './createContext'
import { evaluate } from './interpreter'
import {
  ConstAssignment,
  ExceptionError,
  InterruptedError,
  RuntimeSourceError,
  UndefinedVariable
} from './interpreter-errors'
import { parse } from './parser'
import { AsyncScheduler, PreemptiveScheduler } from './schedulers'
import { transpile } from './transpiler'
import { Context, Error as ResultError, Finished, Result, Scheduler, SourceError } from './types'
import { locationDummyNode } from './utils/astCreator'
import { sandboxedEval } from './utils/evalContainer'

export interface IOptions {
  scheduler: 'preemptive' | 'async'
  steps: number
  isNativeRunnable: boolean
}

const DEFAULT_OPTIONS: IOptions = {
  scheduler: 'async',
  steps: 1000,
  isNativeRunnable: false
}

const resolvedErrorPromise = Promise.resolve({ status: 'error' } as Result)

export function parseError(errors: SourceError[]): string {
  const errorMessagesArr = errors.map(error => {
    const line = error.location ? error.location.start.line : '<unknown>'
    const explanation = error.explain()
    return `Line ${line}: ${explanation}`
  })
  return errorMessagesArr.join('\n')
}

function convertNativeErrorToSourceError(
  error: Error,
  line: number | null,
  column: number | null,
  name: string | null
) {
  // brute-forced from MDN website for phrasing of errors from different browsers
  // FWIW node and chrome uses V8 so they'll have the same error messages
  // unable to test on other engines
  const assignmentToConst = [
    'invalid assignment to const',
    'Assignment to constant variable',
    'Assignment to const',
    'Redeclaration of const'
  ]
  const undefinedVariable = ['is not defined']

  const message = error.message
  if (name === null) {
    name = 'UNKNOWN'
  }

  function messageContains(possibleErrorMessages: string[]) {
    return possibleErrorMessages.some(errorMessage => message.includes(errorMessage))
  }

  if (messageContains(assignmentToConst)) {
    return new ConstAssignment(locationDummyNode(line!, column!), name)
  } else if (messageContains(undefinedVariable)) {
    return new UndefinedVariable(name, locationDummyNode(line!, column!))
  } else {
    const location =
      line === null || column === null
        ? UNKNOWN_LOCATION
        : {
            start: { line, column },
            end: { line: -1, column: -1 }
          }
    return new ExceptionError(error, location)
  }
}

export function runInContext(
  code: string,
  context: Context,
  options: Partial<IOptions> = {}
): Promise<Result> {
  const theOptions: IOptions = { ...DEFAULT_OPTIONS, ...options }
  context.errors = []
  const program = parse(code, context)
  if (program) {
    if (theOptions.isNativeRunnable) {
      let transpiled
      let sourceMapJson
      let lastStatementSourceMapJson
      try {
        const temp = transpile(program, context.contextId)
        // some issues with formatting and semicolons and tslint so
        transpiled = temp[0]
        sourceMapJson = temp[1]
        lastStatementSourceMapJson = temp[2]
        return Promise.resolve({
          status: 'finished',
          value: sandboxedEval(transpiled)
        } as Result)
      } catch (error) {
        if (error instanceof RuntimeSourceError) {
          context.errors.push(error)
          return resolvedErrorPromise
        }
        const errorStack = error.stack
        const match = /<anonymous>:(\d+):(\d+)/.exec(errorStack)
        if (
          match === null ||
          sourceMapJson === undefined ||
          lastStatementSourceMapJson === undefined
        ) {
          context.errors.push(new ExceptionError(error, UNKNOWN_LOCATION))
          return resolvedErrorPromise
        }
        const line = Number(match![1])
        const column = Number(match![2])
        return SourceMapConsumer.with(
          line === 1 ? lastStatementSourceMapJson : sourceMapJson,
          null,
          consumer => {
            const {
              line: originalLine,
              column: originalColumn,
              name
            } = consumer.originalPositionFor({
              line,
              column
            })
            context.errors.push(
              convertNativeErrorToSourceError(error, originalLine, originalColumn, name)
            )
            return resolvedErrorPromise
          }
        )
      }
    } else {
      const it = evaluate(program, context)
      let scheduler: Scheduler
      if (theOptions.scheduler === 'async') {
        scheduler = new AsyncScheduler()
      } else {
        scheduler = new PreemptiveScheduler(theOptions.steps)
      }
      return scheduler.run(it, context)
    }
  } else {
    return resolvedErrorPromise
  }
}

export function resume(result: Result): Finished | ResultError | Promise<Result> {
  if (result.status === 'finished' || result.status === 'error') {
    return result
  } else {
    return result.scheduler.run(result.it, result.context)
  }
}

export function interrupt(context: Context) {
  const globalEnvironment = context.runtime.environments[context.runtime.environments.length - 1]
  context.runtime.environments = [globalEnvironment]
  context.runtime.isRunning = false
  context.errors.push(new InterruptedError(context.runtime.nodes[0]))
}

export { createContext, Context, Result }
