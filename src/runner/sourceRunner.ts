import * as es from 'estree'
import { RawSourceMap } from 'source-map'

import { IOptions, Result } from '..'
import { JSSLANG_PROPERTIES, UNKNOWN_LOCATION } from '../constants'
import { ExceptionError } from '../errors/errors'
import { CannotFindModuleError } from '../errors/localImportErrors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { TimeoutError } from '../errors/timeoutErrors'
import { transpileToGPU } from '../gpu/gpu'
import { isPotentialInfiniteLoop } from '../infiniteLoops/errors'
import { testForInfiniteLoop } from '../infiniteLoops/runtime'
import { evaluate } from '../interpreter/interpreter'
import { nonDetEvaluate } from '../interpreter/interpreter-non-det'
import { transpileToLazy } from '../lazy/lazy'
import { hoistAndMergeImports } from '../localImports/transformers/hoistAndMergeImports'
import { removeExports } from '../localImports/transformers/removeExports'
import { removeNonSourceModuleImports } from '../localImports/transformers/removeNonSourceModuleImports'
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
import { Context, Scheduler, SourceError, Variant } from '../types'
import { forceIt } from '../utils/operators'
import { validateAndAnnotate } from '../validator/validator'
import { compileForConcurrent } from '../vm/svml-compiler'
import { runWithProgram } from '../vm/svml-machine'
import { determineExecutionMethod, hasVerboseErrors } from '.'
import { toSourceError } from './errors'
import { fullJSRunner } from './fullJSRunner'
import { appendModulesToContext, determineVariant, resolvedErrorPromise } from './utils'

const DEFAULT_SOURCE_OPTIONS: IOptions = {
  scheduler: 'async',
  steps: 1000,
  stepLimit: 1000,
  executionMethod: 'auto',
  variant: Variant.DEFAULT,
  originalMaxExecTime: 1000,
  useSubst: false,
  isPrelude: false,
  throwInfiniteLoops: true
}

let previousCode = ''
let isPreviousCodeTimeoutError = false

function runConcurrent(
  code: string,
  program: es.Program,
  context: Context,
  options: IOptions
): Promise<Result> {
  if (previousCode === code) {
    context.nativeStorage.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy
  } else {
    context.nativeStorage.maxExecTime = options.originalMaxExecTime
  }
  context.previousCode.unshift(code)
  previousCode = code
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
  let it = evaluate(program, context)
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
  code: string,
  program: es.Program,
  context: Context,
  options: IOptions
): Promise<Result> {
  if (previousCode === code && isPreviousCodeTimeoutError) {
    context.nativeStorage.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy
  } else if (!options.isPrelude) {
    context.nativeStorage.maxExecTime = options.originalMaxExecTime
  }

  if (!options.isPrelude) {
    context.previousCode.unshift(code)
    previousCode = code
  }

  let transpiled
  let sourceMapJson: RawSourceMap | undefined
  try {
    appendModulesToContext(program, context)
    switch (context.variant) {
      case Variant.GPU:
        transpileToGPU(program)
        break
      case Variant.LAZY:
        transpileToLazy(program)
        break
    }

    ;({ transpiled, sourceMapJson } = transpile(program, context))
    // console.log(transpiled);
    let value = await sandboxedEval(transpiled, context)

    if (context.variant === Variant.LAZY) {
      value = forceIt(value)
    }

    if (!options.isPrelude) {
      isPreviousCodeTimeoutError = false
    }

    return Promise.resolve({
      status: 'finished',
      context,
      value
    })
  } catch (error) {
    const isDefaultVariant = options.variant === undefined || options.variant === Variant.DEFAULT
    if (isDefaultVariant && isPotentialInfiniteLoop(error)) {
      const detectedInfiniteLoop = testForInfiniteLoop(code, context.previousCode.slice(1))
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

export async function sourceRunner(
  code: string,
  context: Context,
  isVerboseErrorsEnabled: boolean,
  options: Partial<IOptions> = {}
): Promise<Result> {
  const theOptions: IOptions = { ...DEFAULT_SOURCE_OPTIONS, ...options }
  context.variant = determineVariant(context, options)
  context.errors = []

  // Parse and validate
  const program: es.Program | undefined = parse(code, context)
  if (!program) {
    return resolvedErrorPromise
  }

  // TODO: Remove this after runners have been refactored.
  //       These should be done as part of the local imports
  //       preprocessing step.
  removeExports(program)
  removeNonSourceModuleImports(program)
  hoistAndMergeImports(program)

  validateAndAnnotate(program, context)
  context.unTypecheckedCode.push(code)

  if (context.errors.length > 0) {
    return resolvedErrorPromise
  }

  if (context.variant === Variant.CONCURRENT) {
    return runConcurrent(code, program, context, theOptions)
  }

  if (theOptions.useSubst) {
    return runSubstitution(program, context, theOptions)
  }

  determineExecutionMethod(theOptions, context, program, isVerboseErrorsEnabled)

  if (context.executionMethod === 'native' && context.variant === Variant.NATIVE) {
    return await fullJSRunner(code, context, theOptions)
  }

  // All runners after this point evaluate the prelude.
  if (context.prelude !== null) {
    const prelude = context.prelude
    context.prelude = null
    await sourceRunner(prelude, context, isVerboseErrorsEnabled, { ...options, isPrelude: true })
    return sourceRunner(code, context, isVerboseErrorsEnabled, options)
  }

  if (context.executionMethod === 'native') {
    return runNative(code, program, context, theOptions)
  }

  return runInterpreter(program, context, theOptions)
}

export async function sourceFilesRunner(
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context,
  options: Partial<IOptions> = {}
): Promise<Result> {
  const entrypointCode = files[entrypointFilePath]
  if (entrypointCode === undefined) {
    context.errors.push(new CannotFindModuleError(entrypointFilePath))
    return resolvedErrorPromise
  }

  const isVerboseErrorsEnabled = hasVerboseErrors(entrypointCode)

  context.variant = determineVariant(context, options)
  // TODO: Make use of the preprocessed program AST after refactoring runners.
  // const preprocessedProgram = preprocessFileImports(files, entrypointFilePath, context)
  // if (!preprocessedProgram) {
  //   return resolvedErrorPromise
  // }

  return sourceRunner(entrypointCode, context, isVerboseErrorsEnabled, options)
}
