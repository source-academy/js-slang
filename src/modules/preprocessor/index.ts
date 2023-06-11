import * as pathlib from 'path'

import { parse } from '../../parser/parser'
import type { AcornOptions } from '../../parser/types'
import type { Context } from '../../types'
import assert from '../../utils/assert'
import { isIdentifier, isModuleDeclaration, isSourceImport } from '../../utils/ast/typeGuards'
import type * as es from '../../utils/ast/types'
import { CircularImportError, ModuleNotFoundError } from '../errors'
import type { ImportResolutionOptions } from '../moduleTypes'
import checkForUndefinedImportsAndReexports from './analyzer'
import { createInvokedFunctionResultVariableDeclaration } from './constructors/contextSpecificConstructors'
import { DirectedGraph } from './directedGraph'
import {
  transformFilePathToValidFunctionName,
  transformFunctionNameToInvokedFunctionResultVariableName
} from './filePaths'
import resolveModule from './resolver'
import hoistAndMergeImports from './transformers/hoistAndMergeImports'
import removeImportsAndExports from './transformers/removeImportsAndExports'
import {
  createAccessImportStatements,
  getInvokedFunctionResultVariableNameToImportSpecifiersMap,
  transformProgramToFunctionDeclaration
} from './transformers/transformProgramToFunctionDeclaration'

/**
 * Error type to indicate that preprocessing has failed but that the context
 * contains the underlying errors
 */
class PreprocessError extends Error {}

const defaultResolutionOptions: Required<ImportResolutionOptions> = {
  allowUndefinedImports: false,
  resolveDirectories: false,
  resolveExtensions: null
}

export const parseProgramsAndConstructImportGraph = async (
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context,
  rawResolutionOptions: Partial<ImportResolutionOptions> = {}
): Promise<{
  programs: Record<string, es.Program>
  importGraph: DirectedGraph
}> => {
  const resolutionOptions = {
    ...defaultResolutionOptions,
    ...rawResolutionOptions
  }
  const programs: Record<string, es.Program> = {}
  const importGraph = new DirectedGraph()

  // If there is more than one file, tag AST nodes with the source file path.
  const numOfFiles = Object.keys(files).length
  const shouldAddSourceFileToAST = numOfFiles > 1

  async function resolve(path: string, node?: es.ModuleDeclarationWithSource) {
    let source: string
    if (node) {
      assert(
        typeof node.source?.value === 'string',
        `${node.type} should have a source of type string, got ${node.source}`
      )
      source = node.source.value
    } else {
      source = path
    }

    const [resolved, modAbsPath] = await resolveModule(
      node ? path : '.',
      source,
      p => files[p] !== undefined,
      resolutionOptions
    )
    if (!resolved) throw new ModuleNotFoundError(modAbsPath, node)
    return modAbsPath
  }

  /**
   * Process each file (as a module) and determine which other (local and source)
   * modules are required. This function should always be called with absolute
   * paths
   *
   * @param currentFilePath Current absolute file path of the module
   */
  async function parseFile(currentFilePath: string): Promise<void> {
    if (isSourceImport(currentFilePath) || currentFilePath in programs) {
      return
    }

    const code = files[currentFilePath]
    assert(
      code !== undefined,
      "Module resolver should've thrown an error if the file path did not resolve"
    )

    // Tag AST nodes with the source file path for use in error messages.
    const parserOptions: Partial<AcornOptions> = shouldAddSourceFileToAST
      ? {
          sourceFile: currentFilePath
        }
      : {}
    const program = parse<AcornOptions>(code, context, parserOptions, false)
    if (!program) {
      // Due to a bug in the typed parser where throwOnError isn't respected,
      // we need to throw a quick exit error here instead
      throw new PreprocessError()
    }

    const dependencies = new Set<string>()
    programs[currentFilePath] = program

    for (const node of program.body) {
      switch (node.type) {
        case 'ExportNamedDeclaration': {
          if (!node.source) continue
        }
        case 'ExportAllDeclaration':
        case 'ImportDeclaration': {
          const modAbsPath = await resolve(currentFilePath, node)
          if (modAbsPath === currentFilePath) {
            throw new CircularImportError([modAbsPath, currentFilePath])
          }

          dependencies.add(modAbsPath)

          // Replace the source of the node with the resolved path
          node.source!.value = modAbsPath
          break
        }
      }
    }

    await Promise.all(
      Array.from(dependencies).map(async dependency => {
        await parseFile(dependency)

        // There is no need to track Source modules as dependencies, as it can be assumed
        // that they will always come first in the topological order
        if (!isSourceImport(dependency)) {
          // If the edge has already been traversed before, the import graph
          // must contain a cycle. Then we can exit early and proceed to find the cycle
          if (importGraph.hasEdge(dependency, currentFilePath)) {
            throw new PreprocessError()
          }

          importGraph.addEdge(dependency, currentFilePath)
        }
      })
    )
  }

  try {
    // Remember to resolve the entrypoint file too!
    const entrypointAbsPath = await resolve(entrypointFilePath)
    await parseFile(entrypointAbsPath)
  } catch (error) {
    if (!(error instanceof PreprocessError)) {
      context.errors.push(error)
    }
  }

  return {
    programs,
    importGraph
  }
}

export type PreprocessOptions = {
  allowUndefinedImports?: boolean
} & ImportResolutionOptions

const defaultOptions: Required<PreprocessOptions> = {
  ...defaultResolutionOptions,
  allowUndefinedImports: false
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
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context,
  rawOptions: Partial<PreprocessOptions> = {}
): Promise<es.Program | undefined> => {
  const { allowUndefinedImports, ...resolutionOptions } = {
    ...defaultOptions,
    ...rawOptions
  }

  // Parse all files into ASTs and build the import graph.
  const { programs, importGraph } = await parseProgramsAndConstructImportGraph(
    files,
    entrypointFilePath,
    context,
    resolutionOptions
  )

  // Return 'undefined' if there are errors while parsing.
  if (context.errors.length !== 0) {
    return undefined
  }

  // Check for circular imports.
  const topologicalOrderResult = importGraph.getTopologicalOrder()
  if (!topologicalOrderResult.isValidTopologicalOrderFound) {
    context.errors.push(new CircularImportError(topologicalOrderResult.firstCycleFound))
    return undefined
  }

  try {
    // Based on how the import graph is constructed, it could be the case that the entrypoint
    // file is never included in the topo order. This is only an issue for the import export
    // analyzer, hence the following code
    const fullTopoOrder = topologicalOrderResult.topologicalOrder
    if (!fullTopoOrder.includes(entrypointFilePath)) {
      // Since it's the entrypoint, it must be loaded last
      fullTopoOrder.push(entrypointFilePath)
    }

    // This check is performed after cycle detection because if we tried to resolve export symbols
    // and there is a cycle in the import graph the constructImportGraph function may end up in an
    // infinite loop
    // For example, a.js: export * from './b.js' and b.js: export * from './a.js'
    // Then trying to discover what symbols are exported by a.js will require determining what symbols
    // b.js exports, which would in turn require the symbols exported by a.js
    // If the topological order exists, then this is guaranteed not to occur
    await checkForUndefinedImportsAndReexports(programs, fullTopoOrder, allowUndefinedImports)
  } catch (error) {
    context.errors.push(error)
    return undefined
  }

  // We want to operate on the entrypoint program to get the eventual
  // preprocessed program.
  const entrypointProgram = programs[entrypointFilePath]
  const entrypointDirPath = pathlib.resolve(entrypointFilePath, '..')

  // Create variables to hold the imported statements.
  const entrypointProgramModuleDeclarations = entrypointProgram.body.filter(isModuleDeclaration)
  const entrypointProgramInvokedFunctionResultVariableNameToImportSpecifiersMap =
    getInvokedFunctionResultVariableNameToImportSpecifiersMap(
      entrypointProgramModuleDeclarations,
      entrypointDirPath
    )
  const entrypointProgramAccessImportStatements = createAccessImportStatements(
    entrypointProgramInvokedFunctionResultVariableNameToImportSpecifiersMap
  )

  // Transform all programs into their equivalent function declaration
  // except for the entrypoint program.
  const functionDeclarations: Record<string, es.FunctionDeclaration> = {}
  for (const [filePath, program] of Object.entries(programs)) {
    // The entrypoint program does not need to be transformed into its
    // function declaration equivalent as its enclosing environment is
    // simply the overall program's (constructed program's) environment.
    if (filePath === entrypointFilePath) {
      continue
    }

    const functionDeclaration = transformProgramToFunctionDeclaration(program, filePath)
    const functionName = functionDeclaration.id?.name
    assert(
      functionName !== undefined,
      'A transformed function declaration is missing its name. This should never happen.'
    )

    functionDeclarations[functionName] = functionDeclaration
  }

  // Invoke each of the transformed functions and store the result in a variable.
  const invokedFunctionResultVariableDeclarations: es.VariableDeclaration[] = []
  topologicalOrderResult.topologicalOrder.forEach((filePath: string): void => {
    // As mentioned above, the entrypoint program does not have a function
    // declaration equivalent, so there is no need to process it.
    if (filePath === entrypointFilePath) {
      return
    }

    const functionName = transformFilePathToValidFunctionName(filePath)
    const invokedFunctionResultVariableName =
      transformFunctionNameToInvokedFunctionResultVariableName(functionName)

    const functionDeclaration = functionDeclarations[functionName]
    const functionParams = functionDeclaration.params.filter(isIdentifier)
    assert(
      functionParams.length === functionDeclaration.params.length,
      'Function declaration contains non-Identifier AST nodes as params. This should never happen.'
    )

    const invokedFunctionResultVariableDeclaration = createInvokedFunctionResultVariableDeclaration(
      functionName,
      invokedFunctionResultVariableName,
      functionParams
    )
    invokedFunctionResultVariableDeclarations.push(invokedFunctionResultVariableDeclaration)
  })

  // Re-assemble the program.
  const preprocessedProgram: es.Program = {
    ...entrypointProgram,
    body: [
      ...Object.values(functionDeclarations),
      ...invokedFunctionResultVariableDeclarations,
      ...entrypointProgramAccessImportStatements,
      ...entrypointProgram.body
    ]
  }
  // Import and Export related nodes are no longer necessary, so we can remove them from the program entirely
  removeImportsAndExports(preprocessedProgram)

  // Finally, we need to hoist all remaining imports to the top of the
  // program. These imports should be source module imports since
  // non-Source module imports would have already been removed. As part
  // of this step, we also merge imports from the same module so as to
  // import each unique name per module only once.
  hoistAndMergeImports(preprocessedProgram, Object.values(programs))
  return preprocessedProgram
}

export default preprocessFileImports
