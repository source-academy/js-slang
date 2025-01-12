import type es from 'estree'
// import * as TypedES from '../../typeChecker/tsESTree'

import type { Context, IOptions } from '../..'
import type { RecursivePartial } from '../../types'
import loadSourceModules from '../loader'
import type { FileGetter } from '../moduleTypes'
import analyzeImportsAndExports from './analyzer'
import parseProgramsAndConstructImportGraph from './linker'
import defaultBundler, { type Bundler } from './bundler'

export type PreprocessResult =
  | {
      ok: true
      program: es.Program
      files: Record<string, string>
      verboseErrors: boolean
    }
  | {
      ok: false
      verboseErrors: boolean
    }

/**
 * Preprocesses file imports and returns a transformed Abstract Syntax Tree (AST).
 * If an error is encountered at any point, returns `undefined` to signify that an
 * error occurred. Details of the error can be found inside `context.errors`.
 *
 * The preprocessing works by transforming each imported file into a function whose
 * parameters are other files (results of transformed functions) and return value
 * is a pair where the head is the default export or null, and the tail is a list
 * of pairs that map from exported names to identifiers.
 *
 * See https://github.com/source-academy/js-slang/wiki/Local-Module-Import-&-Export
 * for more information.
 *
 * @param files              An object mapping absolute file paths to file content.
 * @param entrypointFilePath The absolute path of the entrypoint file.
 * @param context            The information associated with the program evaluation.
 */
const preprocessFileImports = async (
  files: FileGetter,
  entrypointFilePath: string,
  context: Context,
  options: RecursivePartial<IOptions> = {},
  bundler: Bundler = defaultBundler
): Promise<PreprocessResult> => {
  // Load typed source modules into context first to ensure that the type checker has access to all types.
  // TODO: This is a temporary solution, and we should consider a better way to handle this.
  try {
    await loadSourceModules(
      new Set<string>(['rune']),
      context,
      options.importOptions?.loadTabs ?? true
    )
  } catch (error) {
    context.errors.push(error)
    return {
      ok: false,
      verboseErrors: false
    }
  }

  // Parse all files into ASTs and build the import graph.
  const linkerResult = await parseProgramsAndConstructImportGraph(
    files,
    entrypointFilePath,
    context,
    options?.importOptions,
    !!options?.shouldAddFileName
  )
  // Return 'undefined' if there are errors while parsing.
  if (!linkerResult.ok) {
    return linkerResult
  }

  const { programs, topoOrder, sourceModulesToImport } = linkerResult

  try {
    await loadSourceModules(sourceModulesToImport, context, options.importOptions?.loadTabs ?? true)
    // Run type checking on the programs after loading the source modules and their types.
    const linkerResult = await parseProgramsAndConstructImportGraph(
      files,
      entrypointFilePath,
      context,
      options?.importOptions,
      !!options?.shouldAddFileName
    )
    // Return 'undefined' if there are errors while parsing.
    if (!linkerResult.ok) {
      return linkerResult
    }

    analyzeImportsAndExports(
      programs,
      entrypointFilePath,
      topoOrder,
      context,
      options?.importOptions
    )
  } catch (error) {
    context.errors.push(error)
    return {
      ok: false,
      verboseErrors: linkerResult.verboseErrors
    }
  }

  const program = bundler(programs, entrypointFilePath, topoOrder, context)
  return {
    ok: true,
    program,
    files: linkerResult.files,
    verboseErrors: linkerResult.verboseErrors
  }
}

export default preprocessFileImports
