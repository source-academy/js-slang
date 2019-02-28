// import { generate } from 'astring'
import { RawSourceMap, SourceMapConsumer } from 'source-map'
import { UNKNOWN_LOCATION } from './constants'
// import { UNKNOWN_LOCATION } from './constants'
import createContext from './createContext'
import { evaluate } from './interpreter'
import { ExceptionError, InterruptedError, RuntimeSourceError } from './interpreter-errors'
import { parse } from './parser'
import { AsyncScheduler, PreemptiveScheduler } from './schedulers'
import { transpile } from './transpiler'
import { Context, Error, Finished, Result, Scheduler, SourceError } from './types'
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
      let sourceMapJson: RawSourceMap | undefined
      let lastStatementSourceMapJson: RawSourceMap | undefined
      try {
        const temp = transpile(program, context.contextId)
        // some issues with formatting and semicolons and tslint so no destructure
        transpiled = temp.transpiled
        sourceMapJson = temp.codeMap
        lastStatementSourceMapJson = temp.evalMap
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
          match === null
        ) {
          context.errors.push(new ExceptionError(error, UNKNOWN_LOCATION))
          return resolvedErrorPromise
        }
        const line = Number(match![1])
        const column = Number(match![2])
        return SourceMapConsumer.with(
          line === 1 ? lastStatementSourceMapJson! : sourceMapJson!,
          null,
          consumer => {
            const { line: originalLine, column: originalColumn } = consumer.originalPositionFor({
              line,
              column
            })
            const location =
              line === null
                ? UNKNOWN_LOCATION
                : {
                    start: { line: originalLine!, column: originalColumn! },
                    end: { line: -1, column: -1 }
                  }
            context.errors.push(new ExceptionError(error, location))
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

export function resume(result: Result): Finished | Error | Promise<Result> {
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
