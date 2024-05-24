import type es from 'estree'
import * as _ from 'lodash'
import type { RawSourceMap } from 'source-map'

import type { IOptions, Result } from '..'
import { JSSLANG_PROPERTIES } from '../constants'
import { CSEResultPromise, evaluate } from '../cse-machine/interpreter'
import { ExceptionError } from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { TimeoutError } from '../errors/timeoutErrors'
import { transpileToGPU } from '../gpu/gpu'
import { isPotentialInfiniteLoop } from '../infiniteLoops/errors'
import { testForInfiniteLoop } from '../infiniteLoops/runtime'
import preprocessFileImports from '../modules/preprocessor'
import { defaultAnalysisOptions } from '../modules/preprocessor/analyzer'
import { defaultLinkerOptions } from '../modules/preprocessor/linker'
import { parse } from '../parser/parser'
import {
  callee,
  getEvaluationSteps,
  getRedex,
  type IStepperPropContents,
  redexify
} from '../stepper/stepper'
import { sandboxedEval } from '../transpiler/evalContainer'
import { transpile } from '../transpiler/transpiler'
import { Chapter, type Context, type RecursivePartial, Variant } from '../types'
import { validateAndAnnotate } from '../validator/validator'
import type { FileGetter } from '../modules/moduleTypes'
import { mapResult } from '../alt-langs/mapper'
import { toSourceError } from './errors'
import { fullJSRunner } from './fullJSRunner'
import { determineExecutionMethod, determineVariant, resolvedErrorPromise } from './utils'

const DEFAULT_SOURCE_OPTIONS: Readonly<IOptions> = {
  steps: 1000,
  stepLimit: -1,
  executionMethod: 'auto',
  variant: Variant.DEFAULT,
  originalMaxExecTime: 1000,
  useSubst: false,
  isPrelude: false,
  throwInfiniteLoops: true,
  envSteps: -1,
  importOptions: {
    ...defaultAnalysisOptions,
    ...defaultLinkerOptions,
    loadTabs: true
  },
  shouldAddFileName: null
}

let previousCode: {
  files: Partial<Record<string, string>>
  entrypointFilePath: string
} | null = null
let isPreviousCodeTimeoutError = false

function runSubstitution(
  program: es.Program,
  context: Context,
  options: IOptions
): Promise<Result> {
  const steps = getEvaluationSteps(program, context, options)
  if (context.errors.length > 0) {
    return resolvedErrorPromise
  }
  const redexedSteps: IStepperPropContents[] = []
  for (const step of steps) {
    const redex = getRedex(step[0], step[1])
    const redexed = redexify(step[0], step[1])
    redexedSteps.push({
      code: redexed[0],
      redex: redexed[1],
      explanation: step[2],
      function: callee(redex, context)
    })
  }
  return Promise.resolve({
    status: 'finished',
    context,
    value: redexedSteps
  })
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
    }

    ;({ transpiled, sourceMapJson } = transpile(transpiledProgram, context))
    let value = sandboxedEval(transpiled, context.nativeStorage)

    if (!options.isPrelude) {
      isPreviousCodeTimeoutError = false
    }

    return {
      status: 'finished',
      context,
      value
    }
  } catch (error) {
    const isDefaultVariant = options.variant === undefined || options.variant === Variant.DEFAULT
    if (isDefaultVariant && isPotentialInfiniteLoop(error)) {
      const detectedInfiniteLoop = testForInfiniteLoop(
        program,
        context.previousPrograms.slice(1),
        context.nativeStorage.loadedModules
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

    const sourceError = await toSourceError(error, sourceMapJson)
    context.errors.push(sourceError)
    return resolvedErrorPromise
  }
}

function runCSEMachine(program: es.Program, context: Context, options: IOptions): Promise<Result> {
  const value = evaluate(program, context, options)
  return CSEResultPromise(context, value)
}

async function sourceRunner(
  program: es.Program,
  context: Context,
  isVerboseErrorsEnabled: boolean,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  // It is necessary to make a copy of the DEFAULT_SOURCE_OPTIONS object because merge()
  // will modify it rather than create a new object
  const theOptions = _.merge({ ...DEFAULT_SOURCE_OPTIONS }, options)
  context.variant = determineVariant(context, options)

  if (
    context.chapter === Chapter.FULL_JS ||
    context.chapter === Chapter.FULL_TS ||
    context.chapter === Chapter.PYTHON_1
  ) {
    return fullJSRunner(program, context)
  }

  validateAndAnnotate(program, context)
  if (context.errors.length > 0) {
    return resolvedErrorPromise
  }

  if (context.variant === Variant.CONCURRENT) {
    throw new Error('Cannot execute with concurrent variant!')
  }

  determineExecutionMethod(theOptions, context, program, isVerboseErrorsEnabled)

  if (context.executionMethod === 'stepper' || theOptions.useSubst) {
    return runSubstitution(program, context, theOptions)
  }

  // native, don't evaluate prelude
  if (context.executionMethod === 'native' && context.variant === Variant.NATIVE) {
    return await fullJSRunner(program, context)
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

  if (context.variant === Variant.EXPLICIT_CONTROL || context.executionMethod === 'cse-machine') {
    if (options.isPrelude) {
      const preludeContext = { ...context, runtime: { ...context.runtime, debuggerOn: false } }
      const result = await runCSEMachine(program, preludeContext, theOptions)
      // Update object count in main program context after prelude is run
      context.runtime.objectCount = preludeContext.runtime.objectCount
      return result
    }
    return runCSEMachine(program, context, theOptions)
  }

  if (context.executionMethod === 'native') {
    return runNative(program, context, theOptions)
  }

  throw new Error(`Unknown execution method: ${context.executionMethod}`)
}

/**
 * Returns both the Result of the evaluated program, as well as
 * `verboseErrors`.
 */
export async function sourceFilesRunner(
  filesInput: FileGetter,
  entrypointFilePath: string,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<{
  result: Result
  verboseErrors: boolean
}> {
  const preprocessResult = await preprocessFileImports(
    filesInput,
    entrypointFilePath,
    context,
    options
  )

  if (!preprocessResult.ok) {
    return {
      result: { status: 'error' },
      verboseErrors: preprocessResult.verboseErrors
    }
  }

  const { files, verboseErrors, program: preprocessedProgram } = preprocessResult

  context.variant = determineVariant(context, options)
  // FIXME: The type checker does not support the typing of multiple files, so
  //        we only push the code in the entrypoint file. Ideally, all files
  //        involved in the program evaluation should be type-checked. Either way,
  //        the type checker is currently not used at all so this is not very
  //        urgent.
  context.unTypecheckedCode.push(files[entrypointFilePath])

  const currentCode = {
    files,
    entrypointFilePath
  }
  context.shouldIncreaseEvaluationTimeout = _.isEqual(previousCode, currentCode)
  previousCode = currentCode

  context.previousPrograms.unshift(preprocessedProgram)

  const result = await sourceRunner(preprocessedProgram, context, verboseErrors, options)
  const resultMapper = mapResult(context)

  return {
    result: resultMapper(result),
    verboseErrors
  }
}

/**
 * Useful for just running a single line of code with the given context
 * However, if this single line of code is an import statement,
 * then the FileGetter is necessary, otherwise all local imports will
 * fail with ModuleNotFoundError
 */
export function runCodeInSource(
  code: string,
  context: Context,
  options: RecursivePartial<IOptions> = {},
  defaultFilePath: string = '/default.js',
  fileGetter?: FileGetter
) {
  return sourceFilesRunner(
    path => {
      if (path === defaultFilePath) return Promise.resolve(code)
      if (!fileGetter) return Promise.resolve(undefined)
      return fileGetter(path)
    },
    defaultFilePath,
    context,
    options
  )
}
