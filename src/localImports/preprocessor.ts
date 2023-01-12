import es from 'estree'
import * as path from 'path'

import { CannotFindModuleError, CircularImportError } from '../errors/localImportErrors'
import { parse } from '../parser/parser'
import { Context } from '../types'
import { DirectedGraph } from './directedGraph'
import { removeExports } from './transformers/removeExports'
import {
  isSourceModule,
  removeNonSourceModuleImports
} from './transformers/removeNonSourceModuleImports'
import { transformProgramToFunctionDeclaration } from './transformers/transformProgramToFunctionDeclaration'
import { isImportDeclaration } from './typeGuards'

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
  const topologicalOrder = importGraph.getTopologicalOrder()
  if (!topologicalOrder.isValidTopologicalOrderFound) {
    context.errors.push(new CircularImportError(topologicalOrder.firstCycleFound))
    return undefined
  }

  // Remove import/export related nodes in the AST of the entrypoint
  // program because these nodes are not necessarily supported by the
  // Source runner.
  const entrypointProgram = programs[entrypointFilePath]
  // After this pre-processing step, all export-related nodes in the AST
  // are no longer needed and are thus removed.
  removeExports(entrypointProgram)
  // Likewise, all import-related nodes in the AST which are not Source
  // module imports are no longer needed and are also removed.
  removeNonSourceModuleImports(entrypointProgram)

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

  return entrypointProgram
}

export default preprocessFileImports
