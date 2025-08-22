import type { Program } from 'estree'
import * as _ from 'lodash'
import type { Context } from '..'
import { mapResult } from '../alt-langs/mapper'
import { Chapter, Variant } from '../langs'
import type { FileGetter } from '../modules/moduleTypes'
import preprocessFileImports, { type PreprocessorOptions } from '../modules/preprocessor'
import { parse } from '../parser/parser'
import type { RecursivePartial } from '../types'
import { validateAndAnnotate } from '../validator/validator'
import runners, { type RunnerOptions } from './sourceRunner'
import type { Result } from './types'
import { determineExecutionMethod, resolvedErrorPromise } from './utils'

let previousCode: {
  files: Partial<Record<string, string>>
  entrypointFilePath: string
} | null = null

async function sourceRunner(
  program: Program,
  context: Context,
  isVerboseErrorsEnabled: boolean,
  options: RunnerOptions
): Promise<Result> {
  // It is necessary to make a copy of the DEFAULT_SOURCE_OPTIONS object because merge()
  // will modify it rather than create a new object
  // context.variant = context.variant ?? options.variant

  if (
    context.chapter === Chapter.FULL_JS ||
    context.chapter === Chapter.FULL_TS ||
    context.chapter === Chapter.PYTHON_1
  ) {
    return runners.fulljs(program, context, options)
  }

  validateAndAnnotate(program, context)
  if (context.errors.length > 0) {
    return resolvedErrorPromise
  }

  const execMethod = determineExecutionMethod(
    options.executionMethod,
    program,
    isVerboseErrorsEnabled
  )
  // console.log('determined execMethod to be', execMethod)

  if (execMethod === 'substitution') {
    return runners.substitution(program, context, options)
  }

  // native, don't evaluate prelude
  if (execMethod === 'native' && context.variant === Variant.NATIVE) {
    return runners.fulljs(program, context, options)
  }

  // All runners after this point evaluate the prelude.
  if (context.prelude !== null && !options.isPrelude) {
    context.unTypecheckedCode.push(context.prelude)

    const prelude = parse(context.prelude, context)
    if (prelude === null) return resolvedErrorPromise
    const preludeOptions = {
      ...options,
      executionMethod: execMethod,
      isPrelude: true
    }

    await sourceRunner(prelude, context, isVerboseErrorsEnabled, preludeOptions as any)
  }

  if (context.variant === Variant.EXPLICIT_CONTROL || execMethod === 'cse-machine') {
    if (options.isPrelude) {
      const preludeContext = { ...context, runtime: { ...context.runtime, debuggerOn: false } }
      const result = await runners['cse-machine'](program, preludeContext, options)
      // Update object count in main program context after prelude is run
      context.runtime.objectCount = preludeContext.runtime.objectCount
      return result
    }
    return runners['cse-machine'](program, context, options)
  }

  return runners.native(program, context, options)
}

export type IOptions = RecursivePartial<RunnerOptions> & PreprocessorOptions

/**
 * Returns both the Result of the evaluated program, as well as
 * `verboseErrors`.
 */
export async function sourceFilesRunner(
  filesInput: FileGetter,
  entrypointFilePath: string,
  context: Context,
  options: IOptions = {}
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

  const result = await sourceRunner(preprocessedProgram, context, verboseErrors, options as any)
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
  options: IOptions = {},
  defaultFilePath: string = '/default.js',
  fileGetter?: FileGetter
) {
  return sourceFilesRunner(
    path => {
      if (path === defaultFilePath) return Promise.resolve(code)
      if (!fileGetter) return Promise.resolve(undefined)
      return fileGetter(path, options.signal)
    },
    defaultFilePath,
    context,
    options
  )
}

export { htmlRunner } from './htmlRunner'
export { resolvedErrorPromise }
