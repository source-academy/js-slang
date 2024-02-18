import { SourceLocation } from 'estree'
import { SourceMapConsumer } from 'source-map'

import createContext from './createContext'
import { InterruptedError } from './errors/errors'
import { findDeclarationNode, findIdentifierNode } from './finder'
import { looseParse } from './parser/utils'
import { getAllOccurrencesInScopeHelper, getScopeHelper } from './scope-refactoring'
import { setBreakpointAtLine } from './stdlib/inspector'
import {
  type Context,
  type Error as ResultError,
  type Finished,
  type ModuleContext,
  type RecursivePartial,
  type Result,
  type SourceError,
  type SVMProgram,
  Variant} from './types'
import { assemble } from './vm/svml-assembler'
import { compileToIns } from './vm/svml-compiler'
export { SourceDocumentation } from './editors/ace/docTooltip'
import type es from 'estree'

import { CSEResultPromise, resumeEvaluate } from './cse-machine/interpreter'
import { AbsoluteFilePathError, ModuleNotFoundError } from './modules/errors'
import type { ImportOptions, SourceFiles } from './modules/moduleTypes'
import defaultBundler from './modules/preprocessor/bundler'
import { validateFilePaths } from './modules/preprocessor/filePaths'
import parseProgramsAndConstructImportGraph from './modules/preprocessor/linker'
import { isAbsolutePath } from './modules/utils'
import { getKeywords, getProgramNames, NameDeclaration } from './name-extractor'
import { parseWithComments } from './parser/utils'
import { type AllExecutionMethods,resolvedErrorPromise, runFilesInSource } from './runner'

export interface IOptions {
  scheduler: 'preemptive' | 'async'
  steps: number
  stepLimit: number
  variant: Variant
  originalMaxExecTime: number
  useSubst: boolean
  // isPrelude: boolean
  throwInfiniteLoops: boolean
  envSteps: number

  importOptions: ImportOptions

  /**
   * Set this to true if source file information should be
   * added when parsing programs into ASTs
   *
   * Set to null to let js-slang decide automatically
   */
  shouldAddFileName: boolean | null

  logTranspilerOutput: boolean
  auditExecutionMethod: boolean
}

export interface IOptionsWithExecMethod extends IOptions {
  executionMethod: AllExecutionMethods
}

// needed to work on browsers
if (typeof window !== 'undefined') {
  // @ts-ignore
  SourceMapConsumer.initialize({
    'lib/mappings.wasm': 'https://unpkg.com/source-map@0.7.3/lib/mappings.wasm'
  })
}

export function parseError(context: Context): string
export function parseError(errors: SourceError[], verboseErrors?: boolean): string
export function parseError(arg: Context | SourceError[], verboseErrors?: boolean): string {
  const errors = Array.isArray(arg) ? arg : arg.errors
  const verbose = Array.isArray(arg) ? verboseErrors : arg.verboseErrors

  const errorMessagesArr = errors.map(error => {
    // FIXME: Either refactor the parser to output an ESTree-compliant AST, or modify the ESTree types.
    const filePath = error.location?.source ? `[${error.location.source}] ` : ''
    const line = error.location ? error.location.start.line : '<unknown>'
    const column = error.location ? error.location.start.column : '<unknown>'
    if (!error.explain) {
      console.error(error)
      return ''
    }

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

  const [progNames, displaySuggestions] = await getProgramNames(program, comments, cursorLoc)
  const keywords = getKeywords(program, cursorLoc, context)
  return [progNames.concat(keywords), displaySuggestions]
}

export async function runInContext(
  code: string,
  context: Context,
  options: RecursivePartial<IOptionsWithExecMethod> = {}
): Promise<Result> {
  const defaultFilePath = '/default.js'
  const files: SourceFiles = {
    [defaultFilePath]: code
  }
  return runFilesInContext(files, defaultFilePath, context, options)
}

export async function runFilesInContext(
  files: Record<string, string>,
  entrypointFilePath: string,
  context: Context,
  options: RecursivePartial<IOptionsWithExecMethod> = {}
): Promise<Result> {
  try {
    validateFilePaths(files)
  } catch (filePathError) {
    context.errors.push(filePathError)
    return resolvedErrorPromise
  }

  if (!isAbsolutePath(entrypointFilePath)) {
    throw new AbsoluteFilePathError(entrypointFilePath)
  }

  return runFilesInSource(files, entrypointFilePath, context, options)
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
): Promise<SVMProgram | undefined> {
  const defaultFilePath = '/default.js'
  const files: Record<string, string> = {}
  files[defaultFilePath] = code
  return compileFiles(files, defaultFilePath, context, vmInternalFunctions)
}

export async function compileFiles(
  files: Record<string, string>,
  entrypointFilePath: string,
  context: Context,
  vmInternalFunctions?: string[]
): Promise<SVMProgram | undefined> {
  try {
    validateFilePaths(files)
  } catch (filePathError) {
    context.errors.push(filePathError)
    return undefined
  }

  const entrypointCode = files[entrypointFilePath]
  if (entrypointCode === undefined) {
    context.errors.push(new ModuleNotFoundError(entrypointFilePath))
    return undefined
  }

  if (!isAbsolutePath(entrypointFilePath)) {
    throw new AbsoluteFilePathError(entrypointFilePath)
  }

  const linkerResult = await parseProgramsAndConstructImportGraph(
    p => Promise.resolve(files[p]),
    entrypointFilePath,
    context,
    {},
    Object.keys(files).length > 1
  )

  if (!linkerResult.ok) return undefined

  try {
    const { programs, topoOrder } = linkerResult
    const preprocessedProgram = defaultBundler(programs, entrypointFilePath, topoOrder, context)

    return compileToIns(preprocessedProgram, undefined, vmInternalFunctions)
  } catch (error) {
    context.errors.push(error)
    return undefined
  }
}

export { createContext, Context, ModuleContext, Result, setBreakpointAtLine, assemble }
