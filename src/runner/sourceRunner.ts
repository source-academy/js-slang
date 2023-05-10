import { generate } from 'astring'
import * as es from 'estree'
import * as _ from 'lodash'
import { RawSourceMap } from 'source-map'

import { IOptions, Result } from '..'
import { JSSLANG_PROPERTIES, UNKNOWN_LOCATION } from '../constants'
import { ECEResultPromise, evaluate as ECEvaluate } from '../ec-evaluator/interpreter'
import { ExceptionError } from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { TimeoutError } from '../errors/timeoutErrors'
import { transpileToGPU } from '../gpu/gpu'
import { isPotentialInfiniteLoop } from '../infiniteLoops/errors'
import { testForInfiniteLoop } from '../infiniteLoops/runtime'
import { evaluateProgram as evaluate } from '../interpreter/interpreter'
import { nonDetEvaluate } from '../interpreter/interpreter-non-det'
import { transpileToLazy } from '../lazy/lazy'
import { ModuleNotFoundError } from '../modules/errors'
import preprocessFileImports from '../modules/preprocessor'
import { getRequireProvider } from '../modules/requireProvider'
import { parse } from '../parser/parser'
import { AsyncScheduler, NonDetScheduler, PreemptiveScheduler } from '../schedulers'
import {
  callee,
  getEvaluationSteps,
  getRedex,
  IStepperPropContents,
  redexify
} from '../stepper/stepper'
import { sandboxedEval } from '../transpiler/evalContainer'
import { transpile } from '../transpiler/transpiler'
import { Chapter, Context, RecursivePartial, Scheduler, SourceError, Variant } from '../types'
import { forceIt } from '../utils/operators'
import { validateAndAnnotate } from '../validator/validator'
import { compileForConcurrent } from '../vm/svml-compiler'
import { runWithProgram } from '../vm/svml-machine'
import { determineExecutionMethod, hasVerboseErrors } from '.'
import { toSourceError } from './errors'
import { fullJSRunner } from './fullJSRunner'
import { determineVariant, resolvedErrorPromise } from './utils'

const DEFAULT_SOURCE_OPTIONS: IOptions = {
  scheduler: 'async',
  steps: 1000,
  stepLimit: 1000,
  executionMethod: 'auto',
  variant: Variant.DEFAULT,
  originalMaxExecTime: 1000,
  useSubst: false,
  isPrelude: false,
  throwInfiniteLoops: true,

  logTranspilerOutput: false,
  logPreprocessorOutput: true,
  importOptions: {
    loadTabs: true,
    wrapModules: true,
    allowUndefinedImports: false,
    resolveDirectories: false,
    resolveExtensions: null
  }
}

let previousCode: {
  files: Partial<Record<string, string>>
  entrypointFilePath: string
} | null = null
let isPreviousCodeTimeoutError = false

function runConcurrent(program: es.Program, context: Context, options: IOptions): Promise<Result> {
  if (context.shouldIncreaseEvaluationTimeout) {
    context.nativeStorage.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy
  } else {
    context.nativeStorage.maxExecTime = options.originalMaxExecTime
  }

  try {
    return Promise.resolve({
      status: 'finished',
      context,
      value: runWithProgram(compileForConcurrent(program, context), context)
    })
  } catch (error) {
    if (error instanceof RuntimeSourceError || error instanceof ExceptionError) {
      context.errors.push(error) // use ExceptionErrors for non Source Errors
      return resolvedErrorPromise
    }
    context.errors.push(new ExceptionError(error, UNKNOWN_LOCATION))
    return resolvedErrorPromise
  }
}

function runSubstitution(
  program: es.Program,
  context: Context,
  options: IOptions
): Promise<Result> {
  const steps = getEvaluationSteps(program, context, options.stepLimit)
  const redexedSteps: IStepperPropContents[] = []
  for (const step of steps) {
    const redex = getRedex(step[0], step[1])
    const redexed = redexify(step[0], step[1])
    redexedSteps.push({
      code: redexed[0],
      redex: redexed[1],
      explanation: step[2],
      function: callee(redex)
    })
  }
  return Promise.resolve({
    status: 'finished',
    context,
    value: redexedSteps
  })
}

function runInterpreter(program: es.Program, context: Context, options: IOptions): Promise<Result> {
  let it = evaluate(program, context, options.importOptions)
  let scheduler: Scheduler
  if (context.variant === Variant.NON_DET) {
    it = nonDetEvaluate(program, context)
    scheduler = new NonDetScheduler()
  } else if (options.scheduler === 'async') {
    scheduler = new AsyncScheduler()
  } else {
    scheduler = new PreemptiveScheduler(options.steps)
  }
  return scheduler.run(it, context)
}

async function runNative(
  program: es.Program,
  context: Context,
  options: IOptions
): Promise<Result> {
  if (!options.isPrelude) {
    if (context.shouldIncreaseEvaluationTimeout && isPreviousCodeTimeoutError) {
      context.nativeStorage.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy
    } else {
      context.nativeStorage.maxExecTime = options.originalMaxExecTime
    }
  }

  // For whatever reason, the transpiler mutates the state of the AST as it is transpiling and inserts
  // a bunch of global identifiers to it. Once that happens, the infinite loop detection instrumentation
  // ends up generating code that has syntax errors. As such, we need to make a deep copy here to preserve
  // the original AST for future use, such as with the infinite loop detector.
  const transpiledProgram = _.cloneDeep(program)
  let transpiled
  let sourceMapJson: RawSourceMap | undefined
  try {
    switch (context.variant) {
      case Variant.GPU:
        transpileToGPU(transpiledProgram)
        break
      case Variant.LAZY:
        transpileToLazy(transpiledProgram)
        break
    }

    ;({ transpiled, sourceMapJson } = await transpile(
      transpiledProgram,
      context,
      options.importOptions
    ))

    if (options.logTranspilerOutput) console.log(transpiled)
    let value = await sandboxedEval(transpiled, getRequireProvider(context), context.nativeStorage)

    if (context.variant === Variant.LAZY) {
      value = forceIt(value)
    }

    if (!options.isPrelude) {
      isPreviousCodeTimeoutError = false
    }

    return {
      status: 'finished',
      context,
      value
    }
  } catch (error) {
    // console.error(error)
    const isDefaultVariant = options.variant === undefined || options.variant === Variant.DEFAULT
    if (isDefaultVariant && isPotentialInfiniteLoop(error)) {
      const detectedInfiniteLoop = await testForInfiniteLoop(
        program,
        context.previousPrograms.slice(1)
      )
      if (detectedInfiniteLoop !== undefined) {
        if (options.throwInfiniteLoops) {
          context.errors.push(detectedInfiniteLoop)
          return resolvedErrorPromise
        } else {
          error.infiniteLoopError = detectedInfiniteLoop
          if (error instanceof ExceptionError) {
            ;(error.error as any).infiniteLoopError = detectedInfiniteLoop
          }
        }
      }
    }
    if (error instanceof RuntimeSourceError) {
      context.errors.push(error)
      if (error instanceof TimeoutError) {
        isPreviousCodeTimeoutError = true
      }
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

    const sourceError: SourceError = await toSourceError(error, sourceMapJson)
    context.errors.push(sourceError)
    return resolvedErrorPromise
  }
}

function runECEvaluator(program: es.Program, context: Context, options: IOptions): Promise<Result> {
  const value = ECEvaluate(program, context, options)
  return ECEResultPromise(context, value)
}

export async function sourceRunner(
  program: es.Program,
  context: Context,
  isVerboseErrorsEnabled: boolean,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  const theOptions: IOptions = {
    ...DEFAULT_SOURCE_OPTIONS,
    ...options,
    importOptions: {
      ...DEFAULT_SOURCE_OPTIONS.importOptions,
      ...(options?.importOptions ?? {})
    }
  }
  if (context.chapter === Chapter.FULL_JS) {
    return fullJSRunner(program, context, theOptions)
  }

  context.variant = determineVariant(context, options)

  validateAndAnnotate(program, context)
  if (context.errors.length > 0) {
    return resolvedErrorPromise
  }

  if (context.variant === Variant.CONCURRENT) {
    return runConcurrent(program, context, theOptions)
  }

  if (theOptions.useSubst) {
    return runSubstitution(program, context, theOptions)
  }

  determineExecutionMethod(theOptions, context, program, isVerboseErrorsEnabled)

  if (context.executionMethod === 'native' && context.variant === Variant.NATIVE) {
    return fullJSRunner(program, context, theOptions)
  }

  // All runners after this point evaluate the prelude.
  if (context.prelude !== null) {
    context.unTypecheckedCode.push(context.prelude)
    const prelude = parse(context.prelude, context)
    if (prelude === null) {
      return resolvedErrorPromise
    }
    context.prelude = null
    await sourceRunner(prelude, context, isVerboseErrorsEnabled, { ...options, isPrelude: true })
    return sourceRunner(program, context, isVerboseErrorsEnabled, options)
  }

  if (context.variant === Variant.EXPLICIT_CONTROL) {
    return runECEvaluator(program, context, theOptions)
  }

  if (context.executionMethod === 'ec-evaluator') {
    if (options.isPrelude) {
      return runECEvaluator(
        program,
        { ...context, runtime: { ...context.runtime, debuggerOn: false } },
        theOptions
      )
    }
    return runECEvaluator(program, context, theOptions)
  }

  if (context.executionMethod === 'native') {
    return runNative(program, context, theOptions)
  }

  return runInterpreter(program, context, theOptions)
}

export async function sourceFilesRunner(
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  const entrypointCode = files[entrypointFilePath]
  if (entrypointCode === undefined) {
    context.errors.push(new ModuleNotFoundError(entrypointFilePath))
    return resolvedErrorPromise
  }

  const isVerboseErrorsEnabled = hasVerboseErrors(entrypointCode)

  context.variant = determineVariant(context, options)
  // FIXME: The type checker does not support the typing of multiple files, so
  //        we only push the code in the entrypoint file. Ideally, all files
  //        involved in the program evaluation should be type-checked. Either way,
  //        the type checker is currently not used at all so this is not very
  //        urgent.
  context.unTypecheckedCode.push(entrypointCode)

  const currentCode = {
    files,
    entrypointFilePath
  }
  context.shouldIncreaseEvaluationTimeout = _.isEqual(previousCode, currentCode)
  previousCode = currentCode

  const preprocessedProgram = await preprocessFileImports(
    files,
    entrypointFilePath,
    context,
    options.importOptions
  )
  if (!preprocessedProgram) {
    return resolvedErrorPromise
  }

  if (options.logPreprocessorOutput) {
    console.log(generate(preprocessedProgram))
  }
  context.previousPrograms.unshift(preprocessedProgram)

  return sourceRunner(preprocessedProgram, context, isVerboseErrorsEnabled, options)
}
