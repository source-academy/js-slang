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
      // Since the file at 'currentFilePath' contains the import statement
      // from the file at 'importedLocalModulePath', we treat the former
      // as the destination node and the latter as the source node in our
      // import graph. This is because when we insert the transformed IIFEs
      // into the resulting program, we need to start with the IIFEs that
      // do not depend on other IIFEs.
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
  const { programs, importGraph } = parseProgramsAndConstructImportGraph(
    files,
    entrypointFilePath,
    context
  )
  // Return 'undefined' if there are errors while parsing.
  if (context.errors.length !== 0) {
    return undefined
  }

  const topologicalOrder = importGraph.getTopologicalOrder()
  if (!topologicalOrder.isValidTopologicalOrderFound) {
    context.errors.push(new CircularImportError(topologicalOrder.firstCycleFound))
    return undefined
  }

  // After this pre-processing step, all export-related nodes in the AST
  // are no longer needed and are thus removed.
  removeExports(programs[entrypointFilePath])
  // Likewise, all import-related nodes in the AST which are not Source
  // module imports are no longer needed and are also removed.
  removeNonSourceModuleImports(programs[entrypointFilePath])

  return programs[entrypointFilePath]
}

export default preprocessFileImports
