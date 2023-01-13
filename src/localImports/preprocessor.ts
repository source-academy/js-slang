import es from 'estree'
import * as path from 'path'

import { CannotFindModuleError, CircularImportError } from '../errors/localImportErrors'
import { parse } from '../parser/parser'
import { Context } from '../types'
import { isIdentifier } from '../utils/rttc'
import { createInvokedFunctionResultVariableDeclaration } from './constructors/contextSpecificConstructors'
import { DirectedGraph } from './directedGraph'
import {
  transformFilePathToValidFunctionName,
  transformFunctionNameToInvokedFunctionResultVariableName
} from './filePaths'
import { hoistAndMergeImports } from './transformers/hoistAndMergeImports'
import { removeExports } from './transformers/removeExports'
import {
  isSourceModule,
  removeNonSourceModuleImports
} from './transformers/removeNonSourceModuleImports'
import {
  createAccessImportStatements,
  getInvokedFunctionResultVariableNameToImportSpecifiersMap,
  transformProgramToFunctionDeclaration
} from './transformers/transformProgramToFunctionDeclaration'
import { isImportDeclaration, isModuleDeclaration } from './typeGuards'

/**
 * Returns all absolute local module paths which should be imported.
 * This function makes use of the file path of the current file to
 * determine the absolute local module paths.
 *
 * Note that the current file path must be absolute.
 *
 * @param program         The program to be operated on.
 * @param currentFilePath The file path of the current file.
 */
export const getImportedLocalModulePaths = (
  program: es.Program,
  currentFilePath: string
): Set<string> => {
  if (!path.isAbsolute(currentFilePath)) {
    throw new Error(`Current file path '${currentFilePath}' is not absolute.`)
  }

  const baseFilePath = path.resolve(currentFilePath, '..')
  const importedLocalModuleNames: Set<string> = new Set()
  const importDeclarations = program.body.filter(isImportDeclaration)
  importDeclarations.forEach((importDeclaration: es.ImportDeclaration): void => {
    const modulePath = importDeclaration.source.value
    if (typeof modulePath !== 'string') {
      throw new Error('Module names must be strings.')
    }
    if (!isSourceModule(modulePath)) {
      const absoluteModulePath = path.resolve(baseFilePath, modulePath)
      importedLocalModuleNames.add(absoluteModulePath)
    }
  })
  return importedLocalModuleNames
}

const parseProgramsAndConstructImportGraph = (
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context
): {
  programs: Record<string, es.Program>
  importGraph: DirectedGraph
} => {
  const programs: Record<string, es.Program> = {}
  const importGraph = new DirectedGraph()

  const parseFile = (currentFilePath: string): void => {
    const code = files[currentFilePath]
    if (code === undefined) {
      context.errors.push(new CannotFindModuleError(entrypointFilePath))
      return
    }

    const program = parse(code, context)
    if (program === undefined) {
      return
    }

    programs[currentFilePath] = program

    const importedLocalModulePaths = getImportedLocalModulePaths(program, currentFilePath)
    for (const importedLocalModulePath of importedLocalModulePaths) {
      // If the source & destination nodes in the import graph are the
      // same, then the file is trying to import from itself. This is a
      // special case of circular imports.
      if (importedLocalModulePath === currentFilePath) {
        context.errors.push(new CircularImportError([importedLocalModulePath, currentFilePath]))
        return
      }
      // If we traverse the same edge in the import graph twice, it means
      // that there is a cycle in the graph. We terminate early so as not
      // to get into an infinite loop (and also because there is no point
      // in traversing cycles when our goal is to build up the import
      // graph).
      if (importGraph.hasEdge(importedLocalModulePath, currentFilePath)) {
        continue
      }
      // Since the file at 'currentFilePath' contains the import statement
      // from the file at 'importedLocalModulePath', we treat the former
      // as the destination node and the latter as the source node in our
      // import graph. This is because when we insert the transformed
      // function declarations into the resulting program, we need to start
      // with the function declarations that do not depend on other
      // function declarations.
      importGraph.addEdge(importedLocalModulePath, currentFilePath)
      // Recursively parse imported files.
      parseFile(importedLocalModulePath)
    }
  }

  parseFile(entrypointFilePath)

  return {
    programs,
    importGraph
  }
}

const getSourceModuleImports = (programs: Record<string, es.Program>): es.ImportDeclaration[] => {
  const sourceModuleImports: es.ImportDeclaration[] = []
  Object.values(programs).forEach((program: es.Program): void => {
    const importDeclarations = program.body.filter(isImportDeclaration)
    importDeclarations.forEach((importDeclaration: es.ImportDeclaration): void => {
      const importSource = importDeclaration.source.value
      if (typeof importSource !== 'string') {
        throw new Error('Module names must be strings.')
      }
      if (isSourceModule(importSource)) {
        sourceModuleImports.push(importDeclaration)
      }
    })
  })
  return sourceModuleImports
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
const preprocessFileImports = (
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context
): es.Program | undefined => {
  // Parse all files into ASTs and build the import graph.
  const { programs, importGraph } = parseProgramsAndConstructImportGraph(
    files,
    entrypointFilePath,
    context
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
    if (functionName === undefined) {
      throw new Error(
        'A transformed function declaration is missing its name. This should never happen.'
      )
    }

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
    if (functionParams.length !== functionDeclaration.params.length) {
      throw new Error(
        'Function declaration contains non-Identifier AST nodes as params. This should never happen.'
      )
    }

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

  // After this pre-processing step, all export-related nodes in the AST
  // are no longer needed and are thus removed.
  removeExports(preprocessedProgram)
  // Likewise, all import-related nodes in the AST which are not Source
  // module imports are no longer needed and are also removed.
  removeNonSourceModuleImports(preprocessedProgram)
  // Finally, we need to hoist all remaining imports to the top of the
  // program. These imports should be source module imports since
  // non-Source module imports would have already been removed. As part
  // of this step, we also merge imports from the same module so as to
  // import each unique name per module only once.
  hoistAndMergeImports(preprocessedProgram)

  return preprocessedProgram
}

export default preprocessFileImports
