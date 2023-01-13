import es from 'estree'

import { createImportDeclaration } from '../constructors/baseConstructors'
import { isImportDeclaration } from '../typeGuards'

/**
 * Hoists import declarations to the top of the program & merges duplicate
 * imports for the same module.
 *
 * @param program The AST which should have its ImportDeclaration nodes
 *                hoisted & duplicate imports merged.
 */
export const hoistAndMergeImports = (program: es.Program): void => {
  // Separate import declarations from non-import declarations.
  const importDeclarations = program.body.filter(isImportDeclaration)
  const nonImportDeclarations = program.body.filter(
    (node: es.Directive | es.Statement | es.ModuleDeclaration): boolean =>
      !isImportDeclaration(node)
  )

  // Merge import sources & specifiers.
  const importSourceToSpecifiersMap: Map<
    es.Literal,
    Set<es.ImportSpecifier | es.ImportDefaultSpecifier | es.ImportNamespaceSpecifier>
  > = new Map()
  for (const importDeclaration of importDeclarations) {
    const importSource = importDeclaration.source
    const specifiers = importSourceToSpecifiersMap.get(importSource) ?? new Set()
    for (const specifier of importDeclaration.specifiers) {
      specifiers.add(specifier)
    }
    importSourceToSpecifiersMap.set(importSource, specifiers)
  }

  // Convert the merged import sources & specifiers back into import declarations.
  const mergedImportDeclarations: es.ImportDeclaration[] = []
  importSourceToSpecifiersMap.forEach(
    (
      specifiers: Set<es.ImportSpecifier | es.ImportDefaultSpecifier | es.ImportNamespaceSpecifier>,
      importSource: es.Literal
    ): void => {
      mergedImportDeclarations.push(createImportDeclaration(Array.from(specifiers), importSource))
    }
  )

  // Hoist the merged import declarations to the top of the program body.
  program.body = [...mergedImportDeclarations, ...nonImportDeclarations]
}
