import * as _ from 'lodash'
import type { Program } from 'estree'
import type { Context, IOptions, Result } from '..'
import { mapResult } from '../alt-langs/mapper'
import type { FileGetter } from '../modules/moduleTypes'
import preprocessFileImports from '../modules/preprocessor'
import { Chapter, Variant, type RecursivePartial } from '../types'
import { validateAndAnnotate } from '../validator/validator'
import { parse } from '../parser/parser'
import assert from '../utils/assert'
import { defaultAnalysisOptions } from '../modules/preprocessor/analyzer'
import { defaultLinkerOptions } from '../modules/preprocessor/linker'
import { determineExecutionMethod, determineVariant, resolvedErrorPromise } from './utils'
import runners from './sourceRunner'

let previousCode: {
  files: Partial<Record<string, string>>
  entrypointFilePath: string
} | null = null

export const DEFAULT_SOURCE_OPTIONS: Readonly<IOptions> = {
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

async function sourceRunner(
  program: Program,
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
    return runners.fulljs(program, context, theOptions)
  }

  validateAndAnnotate(program, context)
  if (context.errors.length > 0) {
    return resolvedErrorPromise
  }

  if (theOptions.useSubst) {
    return runners.substitution(program, context, theOptions)
  }

  determineExecutionMethod(theOptions, context, program, isVerboseErrorsEnabled)

  // native, don't evaluate prelude
  if (context.executionMethod === 'native' && context.variant === Variant.NATIVE) {
    return runners.fulljs(program, context, theOptions)
  }

  // All runners after this point evaluate the prelude.
  if (context.prelude !== null && !options.isPrelude) {
    context.unTypecheckedCode.push(context.prelude)
    
    const prelude = parse(context.prelude, context)
    if (prelude === null) return resolvedErrorPromise

    await sourceRunner(prelude, context, isVerboseErrorsEnabled, { ...options, isPrelude: true })
  }

  if (context.variant === Variant.EXPLICIT_CONTROL || context.executionMethod === 'cse-machine') {
    if (options.isPrelude) {
      const preludeContext = { ...context, runtime: { ...context.runtime, debuggerOn: false } }
      const result = await runners['cse-machine'](program, preludeContext, theOptions)
      // Update object count in main program context after prelude is run
      context.runtime.objectCount = preludeContext.runtime.objectCount
      return result
    }
    return runners['cse-machine'](program, context, theOptions)
  }

  assert(
    context.executionMethod !== 'auto',
    'Execution method should have been properly determined!'
  )
  return runners.native(program, context, theOptions)
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

export { htmlRunner } from './htmlRunner'
export { resolvedErrorPromise }
