import * as _ from 'lodash'
import type { RawSourceMap } from 'source-map'

import type { IOptions, IOptionsWithExecMethod, Result } from '..'
import { JSSLANG_PROPERTIES, UNKNOWN_LOCATION } from '../constants'
import { CSEResultPromise, evaluate as CSEvaluate } from '../cse-machine/interpreter'
import { ExceptionError } from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { TimeoutError } from '../errors/timeoutErrors'
import { transpileToGPU } from '../gpu/gpu'
import { isPotentialInfiniteLoop } from '../infiniteLoops/errors'
import { testForInfiniteLoop } from '../infiniteLoops/runtime'
import { evaluateProgram as interpreterEval } from '../interpreter/interpreter'
import { nonDetEvaluate } from '../interpreter/interpreter-non-det'
import { transpileToLazy } from '../lazy/lazy'
import type { AbsolutePath, FileGetter, SourceFiles } from '../modules/moduleTypes'
import analyzeImportsAndExports, { defaultAnalysisOptions } from '../modules/preprocessor/analyzer'
import parseProgramsAndConstructImportGraph, {
  defaultLinkerOptions,
  isLinkerSuccess,
  type LinkerSuccessResult
} from '../modules/preprocessor/linker'
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
import { Chapter, Context, RecursivePartial, Scheduler, Variant } from '../types'
import { forceIt } from '../utils/operators'
import { validateAndAnnotate } from '../validator/validator'
import { compileForConcurrent } from '../vm/svml-compiler'
import { runWithProgram } from '../vm/svml-machine'
import { toSourceError } from './errors'
import { fullJSRunner } from './fullJSRunner'
import { determineVariant, resolvedErrorPromise } from './utils'
import type { Program } from 'estree'
import { simple } from '../utils/walkers'
import loadSourceModules from '../modules/loader'
import defaultBundler, { type Bundler } from '../modules/preprocessor/bundler'
import { decodeError, decodeValue } from '../parser/scheme'
import { htmlRunner } from './htmlRunner'
import { ModuleNotFoundError } from '../modules/errors'
import { parse } from '../parser/parser'
import assert from '../utils/assert'
import { areBreakpointsSet } from '../stdlib/inspector'

const DEFAULT_SOURCE_OPTIONS: Readonly<IOptionsWithExecMethod> = {
  scheduler: 'async',
  steps: 1000,
  stepLimit: -1,
  executionMethod: 'auto',
  variant: Variant.DEFAULT,
  originalMaxExecTime: 1000,
  useSubst: false,
  throwInfiniteLoops: true,
  envSteps: -1,
  importOptions: {
    ...defaultAnalysisOptions,
    ...defaultLinkerOptions,
    wrapSourceModules: true,
    loadTabs: true
  },
  shouldAddFileName: null,

  // Debugging options
  logTranspilerOutput: process.env.NODE_ENV === 'development',
  auditExecutionMethod: process.env.NODE_ENV === 'development'
}

let previousCode: {
  files: Partial<Record<string, string>>
  entrypointFilePath: string
} | null = null

type Runner = (
  linkerResult: LinkerSuccessResult,
  entrypointFilePath: AbsolutePath,
  context: Context,
  options: IOptions
) => Promise<Result>

function createSourceRunner(
  runner: (
    program: Program,
    context: Context,
    options: IOptions,
    isPrelude: boolean
  ) => Promise<Result>,
  doValidation: boolean = true,
  evaluatePreludes: boolean = true,
  bundler: Bundler = defaultBundler
): Runner {
  return async (linkerResult, entrypointFilePath, context, options) => {
    const { programs, topoOrder, sourceModulesToImport } = linkerResult

    try {
      // Step 2 Load Source modules
      await loadSourceModules(
        sourceModulesToImport,
        context,
        options.importOptions?.loadTabs ?? true
      )

      // Step 3 Check for undefined imports and duplicate imports
      analyzeImportsAndExports(
        programs,
        entrypointFilePath,
        topoOrder,
        context,
        options?.importOptions
      )
    } catch (error) {
      context.errors.push(error)
      return resolvedErrorPromise
    }

    // Step 4 Take the multiple programs and turn them into 1
    const bundledProgram = bundler(programs, entrypointFilePath, topoOrder, context)
    if (doValidation) {
      // Step 5
      // Validation and Annotation

      // Source specific syntax errors are caught here
      validateAndAnnotate(bundledProgram, context)
      if (context.errors.length > 0) return resolvedErrorPromise
    }

    context.previousPrograms.unshift(bundledProgram)

    if (context.prelude !== null && evaluatePreludes) {
      context.unTypecheckedCode.push(context.prelude)
      const prelude = parse(context.prelude, context)

      assert(prelude !== null, 'Prelude should not have parsing errors!')
      const preludeResult = await runner(prelude, context, options, true)

      assert(preludeResult.status === 'finished', 'Prelude should not do anything but declare things and have no evaluation errors')
    }

    return runner(bundledProgram, context, options, false)
  }
}

export const runners = {
  concurrent: createSourceRunner((program, context, options) => {
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
  }),
  ['cse-machine']: createSourceRunner((program, context, options, isPrelude) => {
    const value = CSEvaluate(program, context, options, isPrelude)
    return CSEResultPromise(context, value)
  }),
  fullJS: createSourceRunner(fullJSRunner, false),
  interpreter: createSourceRunner((program, context, options) => {
    let it = interpreterEval(program, context)
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
  }),
  native: createSourceRunner(async (program, context, options, isPrelude) => {
    if (!isPrelude) {
      if (context.shouldIncreaseEvaluationTimeout && context.isPreviousCodeTimeoutError) {
        context.nativeStorage.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy
      } else {
        context.nativeStorage.maxExecTime = options.originalMaxExecTime
      }
    }

    if (context.variant === Variant.NATIVE) {
      return fullJSRunner(program, context, options)
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

      ;({ transpiled, sourceMapJson } = transpile(transpiledProgram, context))
      if (options.logTranspilerOutput) console.log(transpiled)
      let value = sandboxedEval(transpiled, context.nativeStorage)

      if (context.variant === Variant.LAZY) {
        value = forceIt(value)
      }

      if (!isPrelude) {
        context.isPreviousCodeTimeoutError = false
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
          context
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
          context.isPreviousCodeTimeoutError = true
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
  }),
  scheme: createSourceRunner(async (program, context, options) => {
    const result = await fullJSRunner(program, context, options)
    if (result.status === 'finished') {
      return {
        ...result,
        value: decodeValue(result.value)
      }
    }

    context.errors = context.errors.map(decodeError)
    return result
  }),
  stepper: createSourceRunner((program, context, options) => {
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
  })
} satisfies Record<string, Runner>

type SourceExecutionMethod = keyof typeof runners
export type AllExecutionMethods = SourceExecutionMethod | 'html' | 'auto'

function determineExecutionMethod(
  programs: Record<AbsolutePath, Program>,
  options: IOptionsWithExecMethod,
  context: Context,
  verboseErrors: boolean
): [method: SourceExecutionMethod, reason: string] {
  const specifiedExecMethod =
    options.executionMethod !== 'auto' ? options.executionMethod : context.executionMethod
  assert(
    specifiedExecMethod !== 'html',
    "If execution method is HTML this function shouldn't have been called"
  )

  function warnCorrectMethodForVariant(variant: Variant, method: SourceExecutionMethod) {
    if (specifiedExecMethod !== 'auto' && specifiedExecMethod !== method) {
      console.warn(
        `Variant given as ${variant}, which requires execution method ${method}, but execution method was given as ${specifiedExecMethod}, ignoring...`
      )
    }

    return `Variant given as ${variant}, using ${method}`
  }

  function warnCorrectMethodForChapter(chapter: Chapter, method: SourceExecutionMethod) {
    const chapterName = Object.keys(Chapter).find(name => Chapter[name] === chapter)!
    if (specifiedExecMethod !== 'auto' && specifiedExecMethod !== method) {
      console.warn(
        `Chapter given as ${chapterName}, which requires execution method ${method}, but execution method was given as ${specifiedExecMethod}, ignoring...`
      )
    } else {
    }
    return `Chapter given as ${chapterName}, using ${method}`
  }

  if (context.chapter <= +Chapter.SCHEME_1 && context.chapter >= +Chapter.FULL_SCHEME) {
    return ['scheme', warnCorrectMethodForChapter(context.chapter, 'scheme')]
  }

  // TODO: Remove and make frontend specify stepper explicitly
  if (options.useSubst) {
    return ['stepper', `useSubst is true, using stepper`]
  }

  switch (context.variant) {
    case Variant.CONCURRENT: {
      return ['concurrent', warnCorrectMethodForVariant(context.variant, 'concurrent')]
    }
    case Variant.EXPLICIT_CONTROL: {
      return ['cse-machine', warnCorrectMethodForVariant(context.variant, 'cse-machine')]
    }
    case Variant.LAZY:
    case Variant.GPU: {
      return ['native', warnCorrectMethodForVariant(context.variant, 'native')]
    }
  }

  if (
    context.chapter === Chapter.FULL_JS ||
    context.chapter === Chapter.FULL_TS ||
    context.chapter === Chapter.PYTHON_1
  ) {
    return ['fullJS', warnCorrectMethodForChapter(context.chapter, 'fullJS')]
  }

  if (specifiedExecMethod !== 'auto') {
    return [
      specifiedExecMethod,
      `Execution method was specified manually as ${specifiedExecMethod}`
    ]
  }

  if (verboseErrors) {
    return ['cse-machine', 'verboseErrors is true, using cse-machine']
  }

  if (areBreakpointsSet()) {
    return ['cse-machine', 'There are breakpoints, using cse-machine']
  }

  for (const [name, program] of Object.entries(programs)) {
    let hasDebuggerStatement = false
    simple(program, {
      DebuggerStatement() {
        hasDebuggerStatement = true
      }
    })

    if (hasDebuggerStatement) {
      return ['cse-machine', `Detected DebuggerStatement in ${name}, using cse-machine`]
    }
  }

  return ['native', 'Using native by default']
}

export async function runFilesInSource(
  fileGetter: FileGetter | SourceFiles,
  entrypointFilePath: AbsolutePath,
  context: Context,
  options: RecursivePartial<IOptionsWithExecMethod> = {}
): Promise<Result> {
  // It is necessary to make a copy of the DEFAULT_SOURCE_OPTIONS object because merge()
  // will modify it rather than create a new object
  const theOptions = _.merge({ ...DEFAULT_SOURCE_OPTIONS }, options)
  context.variant = determineVariant(context, options)

  const getter: FileGetter = typeof fileGetter === 'function' ? fileGetter : p => Promise.resolve(files[p])

  if (context.chapter === Chapter.HTML) {
    const entrypointCode = await getter(entrypointFilePath)
    if (entrypointCode === undefined) {
      context.errors.push(new ModuleNotFoundError(entrypointFilePath))
      return resolvedErrorPromise
    }

    return htmlRunner(entrypointCode, context, theOptions)
  }

  const linkerResult = await parseProgramsAndConstructImportGraph(
    getter,
    entrypointFilePath,
    context,
    theOptions.importOptions,
    options.shouldAddFileName ?? (typeof fileGetter === 'function' || Object.keys(fileGetter).length > 1)
  )

  if (context.verboseErrors === null) {
    context.verboseErrors = linkerResult.isVerboseErrorsEnabled
  }

  if (!isLinkerSuccess(linkerResult)) return resolvedErrorPromise

  const { programs, files, isVerboseErrorsEnabled } = linkerResult

  const [execMethod, reason] = determineExecutionMethod(
    programs,
    theOptions,
    context,
    isVerboseErrorsEnabled
  )
  if (options.auditExecutionMethod) {
    console.log(reason)
  }

  const currentCode = {
    files,
    entrypointFilePath
  }
  context.shouldIncreaseEvaluationTimeout = _.isEqual(previousCode, currentCode)
  previousCode = currentCode

  // FIXME: The type checker does not support the typing of multiple files, so
  //        we only push the code in the entrypoint file. Ideally, all files
  //        involved in the program evaluation should be type-checked. Either way,
  //        the type checker is currently not used at all so this is not very
  //        urgent.
  context.unTypecheckedCode.push(files[entrypointFilePath])

  const runner = runners[execMethod]
  // console.log(`Executing with runner ${execMethod}`)
  return runner(linkerResult, entrypointFilePath, context, theOptions)
}

// export async function sourceRunner(
//   program: es.Program,
//   context: Context,
//   isVerboseErrorsEnabled: boolean,
//   options: RecursivePartial<IOptions> = {}
// ): Promise<Result> {
//   // It is necessary to make a copy of the DEFAULT_SOURCE_OPTIONS object because merge()
//   // will modify it rather than create a new object
//   const theOptions = _.merge({ ...DEFAULT_SOURCE_OPTIONS }, options)
//   context.variant = determineVariant(context, options)

//   validateAndAnnotate(program, context)
//   if (context.errors.length > 0) {
//     return resolvedErrorPromise
//   }

//   if (context.variant === Variant.CONCURRENT) {
//     return runConcurrent(program, context, theOptions)
//   }

//   if (theOptions.useSubst) {
//     return runSubstitution(program, context, theOptions)
//   }

//   determineExecutionMethod(theOptions, context, program, isVerboseErrorsEnabled)

//   if (context.executionMethod === 'native' && context.variant === Variant.NATIVE) {
//     return await fullJSRunner(program, context, theOptions)
//   }

//   // All runners after this point evaluate the prelude.
//   if (context.prelude !== null) {
//     context.unTypecheckedCode.push(context.prelude)
//     const prelude = parse(context.prelude, context)
//     if (prelude === null) {
//       return resolvedErrorPromise
//     }
//     context.prelude = null
//     await sourceRunner(prelude, context, isVerboseErrorsEnabled, { ...options, isPrelude: true })
//     return sourceRunner(program, context, isVerboseErrorsEnabled, options)
//   }

//   if (context.variant === Variant.EXPLICIT_CONTROL) {
//     return runCSEMachine(program, context, theOptions)
//   }

//   if (context.executionMethod === 'cse-machine') {
//     if (options.isPrelude) {
//       return runCSEMachine(
//         program,
//         { ...context, runtime: { ...context.runtime, debuggerOn: false } },
//         theOptions
//       )
//     }
//     return runCSEMachine(program, context, theOptions)
//   }

//   if (context.executionMethod === 'native') {
//     return runNative(program, context, theOptions)
//   }

//   return runInterpreter(program!, context, theOptions)
// }

// export async function sourceFilesRunner(
//   files: SourceFiles,
//   entrypointFilePath: AbsolutePath,
//   context: Context,
//   options: RecursivePartial<IOptions> = {}
// ): Promise<Result> {
//   const entrypointCode = files[entrypointFilePath]
//   if (entrypointCode === undefined) {
//     context.errors.push(new ModuleNotFoundError(entrypointFilePath))
//     return resolvedErrorPromise
//   }

//   const isVerboseErrorsEnabled = hasVerboseErrors(entrypointCode)

//   context.variant = determineVariant(context, options)

//   context.unTypecheckedCode.push(entrypointCode)

//   const currentCode = {
//     files,
//     entrypointFilePath
//   }
//   context.shouldIncreaseEvaluationTimeout = _.isEqual(previousCode, currentCode)
//   previousCode = currentCode

//   const preprocessedProgram = await preprocessFileImports(
//     files,
//     context,
//     entrypointFilePath,
//     options
//   )
//   if (!preprocessedProgram) {
//     return resolvedErrorPromise
//   }

//   context.previousPrograms.unshift(preprocessedProgram)

//   return sourceRunner(preprocessedProgram, context, isVerboseErrorsEnabled, options)
// }
