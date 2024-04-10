import type es from 'estree'

import type { Context, IOptions } from '../..'
import type { RecursivePartial } from '../../types'
import loadSourceModules from '../loader'
import type { FileGetter, SourceFiles } from '../moduleTypes'
import analyzeImportsAndExports from './analyzer'
import parseProgramsAndConstructImportGraph from './linker'
import defaultBundler, { type Bundler } from './bundler'

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
  files: SourceFiles | FileGetter,
  entrypointFilePath: string,
  context: Context,
  options: RecursivePartial<IOptions> = {},
  bundler: Bundler = defaultBundler
): Promise<es.Program | undefined> => {
  // Parse all files into ASTs and build the import graph.
  const importGraphResult = await parseProgramsAndConstructImportGraph(
    typeof files === 'function' ? files : p => Promise.resolve(files[p]),
    entrypointFilePath,
    context,
    options?.importOptions,
    options?.shouldAddFileName ?? (typeof files === 'function' || Object.keys(files).length > 1)
  )
  // Return 'undefined' if there are errors while parsing.
  if (!importGraphResult || context.errors.length !== 0) {
    return undefined
  }

  const { programs, topoOrder, sourceModulesToImport } = importGraphResult

  try {
    await loadSourceModules(sourceModulesToImport, context, options.importOptions?.loadTabs ?? true)

    analyzeImportsAndExports(
      programs,
      entrypointFilePath,
      topoOrder,
      context,
      options?.importOptions
    )
  } catch (error) {
    context.errors.push(error)
    return undefined
  }

  return bundler(programs, entrypointFilePath, topoOrder, context)
}

export default preprocessFileImports
