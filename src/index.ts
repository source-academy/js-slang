import { ExpressionStatement, Literal, Program } from 'estree'
import createContext from './createContext'
import { evaluate } from './interpreter'
import { InterruptedError } from './interpreter-errors'
import { parse } from './parser'
import { AsyncScheduler, PreemptiveScheduler } from './schedulers'
import { Context, Error, Finished, Result, Scheduler, SourceError } from './types'

export interface IOptions {
  scheduler: 'preemptive' | 'async'
  steps: number
}

const DEFAULT_OPTIONS: IOptions = {
  scheduler: 'async',
  steps: 1000
}

// deals with parsing error objects and converting them to strings (for repl at least)

let verboseErrors = false

export function parseError(errors: SourceError[], verbose: boolean = verboseErrors): string {
  const errorMessagesArr = errors.map(error => {
    const line = error.location ? error.location.start.line : '<unknown>'
    const column = error.location ? error.location.start.column : '<unknown>'
    const explanation = error.explain()
    const elaboration = error.elaborate()

    if (verbose) {
      // TODO currently elaboration is just tagged on to a new line after the error message itself. find a better
      // way to display it.
      return `Line ${line}, Column ${column}: ${explanation}\n\nTo elaborate: ${elaboration}\n`
    } else {
      return `Line ${line}: ${explanation}`
    }
  })
  return errorMessagesArr.join('\n')
}

export function runInContext(
  code: string,
  context: Context,
  options: Partial<IOptions> = {}
): Promise<Result> {
  function getFirstLine(theProgram: Program) {
    const firstLineOfProgram = theProgram.body[0] as ExpressionStatement
    if (!!firstLineOfProgram) {
      const firstLineExpression = firstLineOfProgram.expression as Literal
      if (!!firstLineExpression) {
        return firstLineExpression.value
      } else {
        return undefined
      }
    } else {
      return undefined
    }
  }
  const theOptions: IOptions = { ...DEFAULT_OPTIONS, ...options }
  context.errors = []
  const program = parse(code, context)
  if (program) {
    if (getFirstLine(program) === 'enable verbose') {
      verboseErrors = true
    }
    const it = evaluate(program, context)
    let scheduler: Scheduler
    if (theOptions.scheduler === 'async') {
      scheduler = new AsyncScheduler()
    } else {
      scheduler = new PreemptiveScheduler(theOptions.steps)
    }
    return scheduler.run(it, context)
  } else {
    return Promise.resolve({ status: 'error' } as Result)
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
  const globalFrame = context.runtime.frames[context.runtime.frames.length - 1]
  context.runtime.frames = [globalFrame]
  context.runtime.isRunning = false
  context.errors.push(new InterruptedError(context.runtime.nodes[0]))
}

export { createContext, Context, Result }
