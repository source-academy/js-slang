import { simple } from 'acorn-walk/dist/walk'
import { DebuggerStatement, Literal, Program, SourceLocation } from 'estree'
import { RawSourceMap, SourceMapConsumer } from 'source-map'
import { JSSLANG_PROPERTIES, UNKNOWN_LOCATION } from './constants'
import createContext from './createContext'
import {
  ConstAssignment,
  ExceptionError,
  InterruptedError,
  UndefinedVariable
} from './errors/errors'
import { RuntimeSourceError } from './errors/runtimeSourceError'
import { findDeclarationNode, findIdentifierNode } from './finder'
import { startEvaluation } from './interpreter/interpreter'
import { parse, parseAt } from './parser/parser'
import { AsyncScheduler, PreemptiveScheduler } from './schedulers'
import { getAllOccurrencesInScope, lookupDefinition, scopeVariables } from './scoped-vars'
import { areBreakpointsSet, setBreakpointAtLine } from './stdlib/inspector'
import { getEvaluationSteps } from './stepper/stepper'
import { sandboxedEval } from './transpiler/evalContainer'
import { transpile } from './transpiler/transpiler'
import {
  Context,
  Error as ResultError,
  ExecutionMethod,
  Finished,
  Result,
  Scheduler,
  SourceError
} from './types'
import { locationDummyNode } from './utils/astCreator'
import { validateAndAnnotate } from './validator/validator'
import lazyEvaluate from './lazyContext'

export interface IOptions {
  scheduler: 'preemptive' | 'async'
  steps: number
  executionMethod: ExecutionMethod
  originalMaxExecTime: number
  useSubst: boolean
}

const DEFAULT_OPTIONS: IOptions = {
  scheduler: 'async',
  steps: 1000,
  executionMethod: 'auto',
  originalMaxExecTime: 1000,
  useSubst: false
}

// needed to work on browsers
// @ts-ignore
SourceMapConsumer.initialize({
  'lib/mappings.wasm': 'https://unpkg.com/source-map@0.7.3/lib/mappings.wasm'
})

// deals with parsing error objects and converting them to strings (for repl at least)

let verboseErrors = false
const resolvedErrorPromise = Promise.resolve({ status: 'error' } as Result)

export function parseError(errors: SourceError[], verbose: boolean = verboseErrors): string {
  const errorMessagesArr = errors.map(error => {
    const line = error.location ? error.location.start.line : '<unknown>'
    const column = error.location ? error.location.start.column : '<unknown>'
    const explanation = error.explain()

    if (verbose) {
      // TODO currently elaboration is just tagged on to a new line after the error message itself. find a better
      // way to display it.
      const elaboration = error.elaborate()
      return `Line ${line}, Column ${column}: ${explanation}\n${elaboration}\n`
    } else {
      return `Line ${line}: ${explanation}`
    }
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
    // make an unknown name more obvious, by making the text
    // an invalid JavaScript variable name
    name = '::???UNKNOWN???::'
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

let previousCode = ''
let isNativeRunnable: boolean

function determineExecutionMethod(theOptions: IOptions, context: Context, program: Program) {
  let isNative
  // options settings overrides context
  if (theOptions.executionMethod === 'auto') {
    if (context.executionMethod === 'auto') {
      // if both options and context set to auto, determine native or not
      if (verboseErrors) {
        isNative = false
      } else if (areBreakpointsSet()) {
        isNative = false
      } else {
        let hasDeuggerStatement = false
        simple(program, {
          DebuggerStatement(node: DebuggerStatement) {
            hasDeuggerStatement = true
          }
        })
        isNative = !hasDeuggerStatement
      }
      context.executionMethod = isNative ? 'native' : 'interpreter'
    } else {
      isNative = context.executionMethod === 'native'
    }
  } else {
    isNative = theOptions.executionMethod === 'native'
  }
  return isNative
}

export function findDeclaration(
  code: string,
  context: Context,
  loc: { line: number; column: number }
): SourceLocation | null | undefined {
  const program = parse(code, context, true)
  if (!program) {
    return null
  }
  const identifierNode = findIdentifierNode(program, context, loc)
  if (!identifierNode) {
    return null
  }
  const declarationNode = findDeclarationNode(program, identifierNode)
  if (!declarationNode || identifierNode === declarationNode) {
    return null
  }
  return declarationNode.loc
}

export async function runInContext(
  code: string,
  context: Context,
  options: Partial<IOptions> = {}
): Promise<Result> {
  function getFirstLine(theCode: string) {
    const theProgramFirstExpression = parseAt(theCode, 0)

    if (theProgramFirstExpression && theProgramFirstExpression.type === 'Literal') {
      return ((theProgramFirstExpression as unknown) as Literal).value
    }

    return undefined
  }
  const theOptions: IOptions = { ...DEFAULT_OPTIONS, ...options }
  context.errors = []

  verboseErrors = getFirstLine(code) === 'enable verbose'
  const program = parse(code, context)
  if (!program) {
    return resolvedErrorPromise
  }
  validateAndAnnotate(program as Program, context)
  if (context.errors.length > 0) {
    return resolvedErrorPromise
  }
  if (options.useSubst) {
    const steps = getEvaluationSteps(program, context)
    return Promise.resolve({
      status: 'finished',
      value: steps
    } as Result)
  }
  isNativeRunnable = determineExecutionMethod(theOptions, context, program)
  if (context.prelude !== null) {
    const prelude = context.prelude
    context.prelude = null
    await runInContext(prelude, context, options)
    return runInContext(code, context, options)
  }
  if (isNativeRunnable) {
    if (previousCode === code) {
      JSSLANG_PROPERTIES.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy
    } else {
      JSSLANG_PROPERTIES.maxExecTime = theOptions.originalMaxExecTime
    }
    previousCode = code
    let transpiled
    let sourceMapJson: RawSourceMap | undefined
    let lastStatementSourceMapJson: RawSourceMap | undefined
    try {
      const temp = transpile(program, context.contextId, undefined, lazyEvaluate(context))
      // some issues with formatting and semicolons and tslint so no destructure
      transpiled = temp.transpiled
      sourceMapJson = temp.codeMap
      lastStatementSourceMapJson = temp.evalMap
      const result = sandboxedEval(transpiled)
      return Promise.resolve({
        status: 'finished',
        value: result
      } as Result)
    } catch (error) {
      if (error instanceof RuntimeSourceError) {
        context.errors.push(error)
        return resolvedErrorPromise
      }
      if (error instanceof ExceptionError) {
        // if we know the location of the error, just throw it
        if (error.location.start.line !== -1) {
          context.errors.push(error)
          return resolvedErrorPromise
        } else {
          error = error.error // else we try to get the location from source map
        }
      }
      const errorStack = error.stack
      const match = /<anonymous>:(\d+):(\d+)/.exec(errorStack)
      if (match === null) {
        context.errors.push(new ExceptionError(error, UNKNOWN_LOCATION))
        return resolvedErrorPromise
      }
      const line = Number(match![1])
      const column = Number(match![2])
      return SourceMapConsumer.with(
        line === 1 ? lastStatementSourceMapJson! : sourceMapJson!,
        null,
        consumer => {
          const { line: originalLine, column: originalColumn, name } = consumer.originalPositionFor(
            {
              line,
              column
            }
          )
          context.errors.push(
            convertNativeErrorToSourceError(error, originalLine, originalColumn, name)
          )
          return resolvedErrorPromise
        }
      )
    }
  } else {
    const it = startEvaluation(program, context)
    let scheduler: Scheduler
    if (theOptions.scheduler === 'async') {
      scheduler = new AsyncScheduler()
    } else {
      scheduler = new PreemptiveScheduler(theOptions.steps)
    }
    return scheduler.run(it, context)
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

export {
  createContext,
  Context,
  Result,
  setBreakpointAtLine,
  scopeVariables,
  lookupDefinition,
  getAllOccurrencesInScope,
  isNativeRunnable
}
