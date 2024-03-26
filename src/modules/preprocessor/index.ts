import { posix as posixPath } from 'path'
import type es from 'estree'

import type { Context, IOptions } from '../..'
import type { RecursivePartial } from '../../types'
import assert from '../../utils/assert'
import { getModuleDeclarationSource } from '../../utils/ast/helpers'
import { isIdentifier, isImportDeclaration, isModuleDeclaration } from '../../utils/ast/typeGuards'
import { isSourceModule } from '../utils'
import loadSourceModules from '../loader'
import analyzeImportsAndExports from './analyzer'
import { createInvokedFunctionResultVariableDeclaration } from './constructors/contextSpecificConstructors'
import {
  transformFilePathToValidFunctionName,
  transformFunctionNameToInvokedFunctionResultVariableName
} from './filePaths'
import parseProgramsAndConstructImportGraph from './linker'
import hoistAndMergeImports from './transformers/hoistAndMergeImports'
import removeExports from './transformers/removeExports'
import {
  createAccessImportStatements,
  getInvokedFunctionResultVariableNameToImportSpecifiersMap,
  transformProgramToFunctionDeclaration
} from './transformers/transformProgramToFunctionDeclaration'

const getSourceModuleImports = (programs: Record<string, es.Program>): es.ImportDeclaration[] => {
  return Object.values(programs).flatMap(program => {
    return program.body.filter((stmt): stmt is es.ImportDeclaration => {
      if (!isImportDeclaration(stmt)) return false

      const importSource = getModuleDeclarationSource(stmt)
      return isSourceModule(importSource)
    })
  })
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
  files: Partial<Record<string, string>> | ((p: string) => Promise<string | undefined>),
  entrypointFilePath: string,
  context: Context,
  options: RecursivePartial<IOptions> = {}
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

  const { programs, topoOrder, entrypointAbsPath, sourceModulesToImport } = importGraphResult

  try {
    await loadSourceModules(sourceModulesToImport, context, options.importOptions?.loadTabs ?? true)

    analyzeImportsAndExports(
      programs,
      entrypointAbsPath,
      topoOrder,
      context,
      options?.importOptions
    )
  } catch (error) {
    context.errors.push(error)
    return undefined
  }

  // We want to operate on the entrypoint program to get the eventual
  // preprocessed program.
  const entrypointProgram = programs[entrypointFilePath]
  const entrypointDirPath = posixPath.resolve(entrypointFilePath, '..')

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
  topoOrder.forEach((filePath: string): void => {
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

  // Get all Source module imports across the entrypoint program & all imported programs.
  const sourceModuleImports = getSourceModuleImports(programs)

  // Re-assemble the program.
  const preprocessedProgram: es.Program = {
    ...entrypointProgram,
    body: [
      ...sourceModuleImports,
      ...Object.values(functionDeclarations),
      ...invokedFunctionResultVariableDeclarations,
      ...entrypointProgramAccessImportStatements,
      ...entrypointProgram.body
    ]
  }

  // We need to hoist all remaining imports to the top of the
  // program. These imports should be source module imports since
  // non-Source module imports would have already been handled. As part
  // of this step, we also merge imports from the same module so as to
  // import each unique name per module only once.
  hoistAndMergeImports(preprocessedProgram)

  // After this pre-processing step, all export-related nodes in the AST
  // are no longer needed and are thus removed.
  removeExports(preprocessedProgram)

  return preprocessedProgram
}

export default preprocessFileImports
