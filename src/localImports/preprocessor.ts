import es from 'estree'
import * as path from 'path'

import { parse } from '../parser/parser'
import { Context } from '../types'
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

const preprocessFileImports = (
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context
): es.Program | undefined => {
  const entrypointCode = files[entrypointFilePath]
  if (entrypointCode === undefined) {
    return undefined
  }

  const program = parse(entrypointCode, context)
  if (program === undefined) {
    return undefined
  }

  // After this pre-processing step, all export-related nodes in the AST
  // are no longer needed and are thus removed.
  removeExports(program)
  // Likewise, all import-related nodes in the AST which are not Source
  // module imports are no longer needed and are also removed.
  removeNonSourceModuleImports(program)

  return program
}

export default preprocessFileImports
