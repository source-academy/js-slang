import * as _ from 'lodash'
import type { Program } from 'estree'
import type { Context, IOptions, Result } from '..'
import { mapResult } from '../alt-langs/mapper'
import type { FileGetter } from '../modules/moduleTypes'
import preprocessFileImports from '../modules/preprocessor'
import { Variant, type RecursivePartial } from '../types'
import { validateAndAnnotate } from '../validator/validator'
import { parse } from '../parser/parser'
import { determineExecutionMethod, determineVariant, resolvedErrorPromise } from './utils'
import runners from './sourceRunner'
import type { ExecutionOptions } from './types'

let previousCode: {
  files: Partial<Record<string, string>>
  entrypointFilePath: string
} | null = null

export const DEFAULT_SOURCE_OPTIONS: Readonly<ExecutionOptions> = {
  steps: 1000,
  stepLimit: -1,
  variant: Variant.DEFAULT,
  originalMaxExecTime: 1000,
  isPrelude: false,
  throwInfiniteLoops: true,
  envSteps: -1
}

async function runProgramInContext(
  program: Program,
  context: Context,
  isVerboseErrorsEnabled: boolean,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  const theOptions: ExecutionOptions = {
    ...DEFAULT_SOURCE_OPTIONS,
    ...options
  }

  context.variant = determineVariant(context, options)
  const execMethod = determineExecutionMethod(
    options.executionMethod ?? 'auto',
    context,
    program,
    isVerboseErrorsEnabled
  )
  context.executionMethod = execMethod
  const { runner, prelude: evaluatePrelude, validate } = runners[execMethod]

  if (validate) {
    validateAndAnnotate(program, context)
    if (context.errors.length > 0) {
      return resolvedErrorPromise
    }
  }

  if (evaluatePrelude && context.prelude !== null) {
    context.unTypecheckedCode.push(context.prelude)
    const prelude = parse(context.prelude, context)
    if (prelude === null) return resolvedErrorPromise
    await runner(prelude, context, { ...theOptions, isPrelude: true })
  }

  return runner(program, context, theOptions)
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

  const result = await runProgramInContext(preprocessedProgram, context, verboseErrors, options)
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
