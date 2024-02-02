import { SourceLocation } from 'estree'
import { SourceMapConsumer } from 'source-map'

import createContext from './createContext'
import { InterruptedError } from './errors/errors'
import { findDeclarationNode, findIdentifierNode } from './finder'
import { looseParse } from './parser/utils'
import { getAllOccurrencesInScopeHelper, getScopeHelper } from './scope-refactoring'
import { setBreakpointAtLine } from './stdlib/inspector'
import {
  Chapter,
  Context,
  Error as ResultError,
  ExecutionMethod,
  Finished,
  ModuleContext,
  RecursivePartial,
  Result,
  SourceError,
  SVMProgram,
  Variant
} from './types'
import { assemble } from './vm/svml-assembler'
import { compileToIns } from './vm/svml-compiler'
export { SourceDocumentation } from './editors/ace/docTooltip'
import * as es from 'estree'

import { CSEResultPromise, resumeEvaluate } from './cse-machine/interpreter'
import { CannotFindModuleError } from './errors/localImportErrors'
import { validateFilePath } from './localImports/filePaths'
import preprocessFileImports from './localImports/preprocessor'
import type { ImportTransformOptions } from './modules/moduleTypes'
import { getKeywords, getProgramNames, NameDeclaration } from './name-extractor'
import { parse } from './parser/parser'
import { decodeError, decodeValue } from './parser/scheme'
import { parseWithComments } from './parser/utils'
import {
  fullJSRunner,
  hasVerboseErrors,
  htmlRunner,
  resolvedErrorPromise,
  sourceFilesRunner
} from './runner'

export interface IOptions {
  scheduler: 'preemptive' | 'async'
  steps: number
  stepLimit: number
  executionMethod: ExecutionMethod
  variant: Variant
  originalMaxExecTime: number
  useSubst: boolean
  isPrelude: boolean
  throwInfiniteLoops: boolean
  envSteps: number

  importOptions: ImportTransformOptions
}

// needed to work on browsers
if (typeof window !== 'undefined') {
  // @ts-ignore
  SourceMapConsumer.initialize({
    'lib/mappings.wasm': 'https://unpkg.com/source-map@0.7.3/lib/mappings.wasm'
  })
}

let verboseErrors: boolean = false

export function parseError(errors: SourceError[], verbose: boolean = verboseErrors): string {
  const errorMessagesArr = errors.map(error => {
    // FIXME: Either refactor the parser to output an ESTree-compliant AST, or modify the ESTree types.
    const filePath = error.location?.source ? `[${error.location.source}] ` : ''
    const line = error.location ? error.location.start.line : '<unknown>'
    const column = error.location ? error.location.start.column : '<unknown>'
    const explanation = error.explain()

    if (verbose) {
      // TODO currently elaboration is just tagged on to a new line after the error message itself. find a better
      // way to display it.
      const elaboration = error.elaborate()
      return line < 1
        ? `${filePath}${explanation}\n${elaboration}\n`
        : `${filePath}Line ${line}, Column ${column}: ${explanation}\n${elaboration}\n`
    } else {
      return line < 1 ? explanation : `${filePath}Line ${line}: ${explanation}`
    }
  })
  return errorMessagesArr.join('\n')
}

export function findDeclaration(
  code: string,
  context: Context,
  loc: { line: number; column: number }
): SourceLocation | null | undefined {
  const program = looseParse(code, context)
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

export function getScope(
  code: string,
  context: Context,
  loc: { line: number; column: number }
): SourceLocation[] {
  const program = looseParse(code, context)
  if (!program) {
    return []
  }
  const identifierNode = findIdentifierNode(program, context, loc)
  if (!identifierNode) {
    return []
  }
  const declarationNode = findDeclarationNode(program, identifierNode)
  if (!declarationNode || declarationNode.loc == null || identifierNode !== declarationNode) {
    return []
  }

  return getScopeHelper(declarationNode.loc, program, identifierNode.name)
}

export function getAllOccurrencesInScope(
  code: string,
  context: Context,
  loc: { line: number; column: number }
): SourceLocation[] {
  const program = looseParse(code, context)
  if (!program) {
    return []
  }
  const identifierNode = findIdentifierNode(program, context, loc)
  if (!identifierNode) {
    return []
  }
  const declarationNode = findDeclarationNode(program, identifierNode)
  if (declarationNode == null || declarationNode.loc == null) {
    return []
  }
  return getAllOccurrencesInScopeHelper(declarationNode.loc, program, identifierNode.name)
}

export function hasDeclaration(
  code: string,
  context: Context,
  loc: { line: number; column: number }
): boolean {
  const program = looseParse(code, context)
  if (!program) {
    return false
  }
  const identifierNode = findIdentifierNode(program, context, loc)
  if (!identifierNode) {
    return false
  }
  const declarationNode = findDeclarationNode(program, identifierNode)
  if (declarationNode == null || declarationNode.loc == null) {
    return false
  }

  return true
}

/**
 * Gets names present within a string of code
 * @param code Code to parse
 * @param line Line position of the cursor
 * @param col Column position of the cursor
 * @param context Evaluation context
 * @returns `[NameDeclaration[], true]` if suggestions should be displayed, `[[], false]` otherwise
 */
export async function getNames(
  code: string,
  line: number,
  col: number,
  context: Context
): Promise<[NameDeclaration[], boolean]> {
  const [program, comments] = parseWithComments(code)

  if (!program) {
    return [[], false]
  }
  const cursorLoc: es.Position = { line, column: col }

  const [progNames, displaySuggestions] = getProgramNames(program, comments, cursorLoc)
  const keywords = getKeywords(program, cursorLoc, context)
  return [progNames.concat(keywords), displaySuggestions]
}

export async function runInContext(
  code: string,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  const defaultFilePath = '/default.js'
  const files: Partial<Record<string, string>> = {}
  files[defaultFilePath] = code
  return runFilesInContext(files, defaultFilePath, context, options)
}

export async function runFilesInContext(
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  for (const filePath in files) {
    const filePathError = validateFilePath(filePath)
    if (filePathError !== null) {
      context.errors.push(filePathError)
      return resolvedErrorPromise
    }
  }

  const code = files[entrypointFilePath]
  if (code === undefined) {
    context.errors.push(new CannotFindModuleError(entrypointFilePath))
    return resolvedErrorPromise
  }

  if (
    context.chapter === Chapter.FULL_JS ||
    context.chapter === Chapter.FULL_TS ||
    context.chapter === Chapter.PYTHON_1
  ) {
    const program = parse(code, context)
    if (program === null) {
      return resolvedErrorPromise
    }
    const fullImportOptions = {
      loadTabs: true,
      checkImports: false,
      wrapSourceModules: false,
      ...options.importOptions
    }
    return fullJSRunner(program, context, fullImportOptions)
  }

  if (context.chapter === Chapter.HTML) {
    return htmlRunner(code, context, options)
  }

  if (context.chapter <= +Chapter.SCHEME_1 && context.chapter >= +Chapter.FULL_SCHEME) {
    // If the language is scheme, we need to format all errors and returned values first
    // Use the standard runner to get the result
    const evaluated: Promise<Result> = sourceFilesRunner(
      files,
      entrypointFilePath,
      context,
      options
    ).then(result => {
      // Format the returned value
      if (result.status === 'finished') {
        return {
          ...result,
          value: decodeValue(result.value)
        } as Finished
      }
      return result
    })
    // Format all errors in the context
    context.errors = context.errors.map(error => decodeError(error))
    return evaluated
  }

  // FIXME: Clean up state management so that the `parseError` function is pure.
  //        This is not a huge priority, but it would be good not to make use of
  //        global state.
  verboseErrors = hasVerboseErrors(code)
  return sourceFilesRunner(files, entrypointFilePath, context, options)
}

export function resume(result: Result): Finished | ResultError | Promise<Result> {
  if (result.status === 'finished' || result.status === 'error') {
    return result
  } else if (result.status === 'suspended-cse-eval') {
    const value = resumeEvaluate(result.context)
    return CSEResultPromise(result.context, value)
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

export function compile(
  code: string,
  context: Context,
  vmInternalFunctions?: string[]
): SVMProgram | undefined {
  const defaultFilePath = '/default.js'
  const files: Partial<Record<string, string>> = {}
  files[defaultFilePath] = code
  return compileFiles(files, defaultFilePath, context, vmInternalFunctions)
}

export function compileFiles(
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context,
  vmInternalFunctions?: string[]
): SVMProgram | undefined {
  for (const filePath in files) {
    const filePathError = validateFilePath(filePath)
    if (filePathError !== null) {
      context.errors.push(filePathError)
      return undefined
    }
  }

  const entrypointCode = files[entrypointFilePath]
  if (entrypointCode === undefined) {
    context.errors.push(new CannotFindModuleError(entrypointFilePath))
    return undefined
  }

  const preprocessedProgram = preprocessFileImports(files, entrypointFilePath, context)
  if (!preprocessedProgram) {
    return undefined
  }

  try {
    return compileToIns(preprocessedProgram, undefined, vmInternalFunctions)
  } catch (error) {
    context.errors.push(error)
    return undefined
  }
}

export { createContext, Context, ModuleContext, Result, setBreakpointAtLine, assemble }
