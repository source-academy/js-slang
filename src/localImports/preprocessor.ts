import es from 'estree'
import * as path from 'path'

import { CircularImportError } from '../errors/localImportErrors'
import { ModuleNotFoundError } from '../modules/errors'
import {
  memoizedGetModuleDocsAsync,
  memoizedGetModuleManifestAsync
} from '../modules/moduleLoaderAsync'
import { ModuleManifest } from '../modules/moduleTypes'
import { parse } from '../parser/parser'
import { AcornOptions } from '../parser/types'
import { Context } from '../types'
import assert from '../utils/assert'
import { isModuleDeclaration, isSourceImport } from '../utils/ast/typeGuards'
import { isIdentifier } from '../utils/rttc'
import { validateImportAndExports } from './analyzer'
import { createInvokedFunctionResultVariableDeclaration } from './constructors/contextSpecificConstructors'
import { DirectedGraph } from './directedGraph'
import {
  transformFilePathToValidFunctionName,
  transformFunctionNameToInvokedFunctionResultVariableName
} from './filePaths'
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

type ModuleResolutionOptions = {
  directory?: boolean
  extensions: string[] | null
}

const defaultResolutionOptions: Required<ModuleResolutionOptions> = {
  directory: false,
  extensions: null
}

const parseProgramsAndConstructImportGraph = async (
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context,
  allowUndefinedImports: boolean,
  rawResolutionOptions: Partial<ModuleResolutionOptions> = {}
): Promise<{
  programs: Record<string, es.Program>
  importGraph: DirectedGraph
  moduleDocs: Record<string, Set<string> | null>
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

  const moduleDocs: Record<string, Set<string> | null> = {}
  let moduleManifest: ModuleManifest | null = null

  // From the given import source, return the absolute path for that import
  // If the import could not be located, then throw an error
  async function resolveModule(
    desiredPath: string,
    node: Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>
  ) {
    const source = node.source?.value
    assert(
      typeof source === 'string',
      `${node.type} should have a source of type string, got ${source}`
    )

    let modAbsPath: string
    if (isSourceImport(source)) {
      if (!moduleManifest) {
        moduleManifest = await memoizedGetModuleManifestAsync()
      }

      if (source in moduleManifest) return source
      modAbsPath = source
    } else {
      modAbsPath = path.resolve(desiredPath, '..', source)
      if (files[modAbsPath] !== undefined) return modAbsPath

      if (resolutionOptions.directory && files[`${modAbsPath}/index`] !== undefined) {
        return `${modAbsPath}/index`
      }

      if (resolutionOptions.extensions) {
        for (const ext of resolutionOptions.extensions) {
          if (files[`${modAbsPath}.${ext}`] !== undefined) return `${modAbsPath}.${ext}`

          if (resolutionOptions.directory && files[`${modAbsPath}/index.${ext}`] !== undefined) {
            return `${modAbsPath}/index.${ext}`
          }
        }
      }
    }

    throw new ModuleNotFoundError(modAbsPath, node)
  }

  const parseFile = async (currentFilePath: string) => {
    if (isSourceImport(currentFilePath)) {
      if (!(currentFilePath in moduleDocs)) {
        // Will not throw ModuleNotFoundError
        // If this were invalid, resolveModule would have thrown already
        if (allowUndefinedImports) {
          moduleDocs[currentFilePath] = null
        } else {
          const docs = await memoizedGetModuleDocsAsync(currentFilePath)
          if (!docs) {
            throw new Error(`Failed to load documentation for ${currentFilePath}`)
          }
          moduleDocs[currentFilePath] = new Set(Object.keys(docs))
        }
      }
      return
    }

    if (currentFilePath in programs) return

    const code = files[currentFilePath]
    assert(
      code !== undefined,
      "Module resolver should've thrown an error if the file path is not resolvable"
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

    // assert(program !== null, 'Parser should throw on error and not just return null')
    programs[currentFilePath] = program

    const dependencies = new Set<string>()
    for (const node of program.body) {
      switch (node.type) {
        case 'ExportNamedDeclaration': {
          if (!node.source) continue
        }
        case 'ExportAllDeclaration':
        case 'ImportDeclaration': {
          const modAbsPath = await resolveModule(currentFilePath, node)
          if (modAbsPath === currentFilePath) {
            throw new CircularImportError([modAbsPath, currentFilePath])
          }

          dependencies.add(modAbsPath)
          node.source!.value = modAbsPath
          break
        }
      }
    }

    await Promise.all(
      Array.from(dependencies.keys()).map(async dependency => {
        await parseFile(dependency)
        if (!isSourceImport(dependency)) {
          if (importGraph.hasEdge(dependency, currentFilePath)) {
            throw new PreprocessError()
          }

          importGraph.addEdge(dependency, currentFilePath)
        }
      })
    )
  }

  try {
    await parseFile(entrypointFilePath)
  } catch (error) {
    // console.log(error)
    if (!(error instanceof PreprocessError)) {
      context.errors.push(error)
    }
  }

  return {
    programs,
    importGraph,
    moduleDocs
  }
}

export type PreprocessOptions = {
  allowUndefinedImports?: boolean
}

const defaultOptions: Required<PreprocessOptions> = {
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
  const { allowUndefinedImports } = {
    ...defaultOptions,
    ...rawOptions
  }

  // Parse all files into ASTs and build the import graph.
  const { programs, importGraph, moduleDocs } = await parseProgramsAndConstructImportGraph(
    files,
    entrypointFilePath,
    context,
    allowUndefinedImports
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
    validateImportAndExports(
      moduleDocs,
      programs,
      topologicalOrderResult.topologicalOrder,
      allowUndefinedImports
    )
  } catch (error) {
    context.errors.push(error)
    return undefined
  }

  // We want to operate on the entrypoint program to get the eventual
  // preprocessed program.
  const entrypointProgram = programs[entrypointFilePath]
  const entrypointDirPath = path.resolve(entrypointFilePath, '..')

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
  const importDecls = hoistAndMergeImports(Object.values(programs))
  preprocessedProgram.body = [...importDecls, ...preprocessedProgram.body]

  return preprocessedProgram
}

export default preprocessFileImports
