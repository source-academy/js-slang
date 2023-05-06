import es from 'estree'

import { isImportDeclaration, isSourceImport } from '../../utils/ast/typeGuards'
import {
  createIdentifier,
  createImportDeclaration,
  createImportDefaultSpecifier,
  createImportSpecifier,
  createLiteral
} from '../constructors/baseConstructors'

/**
 * Hoists import declarations to the top of the program & merges duplicate
 * imports for the same module.
 *
 * Note that two modules are the same if and only if their import source
 * is the same. This function does not resolve paths against a base
 * directory. If such a functionality is required, this function will
 * need to be modified.
 *
 * @param program The AST which should have its ImportDeclaration nodes
 *                hoisted & duplicate imports merged.
 */
export default function hoistAndMergeImports(program: es.Program, programs: es.Program[]) {
  const allNodes = programs.flatMap(({ body }) => body)
  const importNodes = allNodes.filter(isImportDeclaration)
  const importsToSpecifiers = new Map<string, Map<string, Set<string>>>()

  for (const node of importNodes) {
    if (!node.source) continue

    const source = node.source!.value as string
    // We no longer need imports from non-source modules, so we can just ignore them
    if (!isSourceImport(source)) continue

    if (isImportDeclaration(node)) {
      if (!importsToSpecifiers.has(source)) {
        importsToSpecifiers.set(source, new Map())
      }
      const specifierMap = importsToSpecifiers.get(source)!
      node.specifiers.forEach(spec => {
        let importingName: string
        switch (spec.type) {
          case 'ImportSpecifier': {
            importingName = spec.imported.name
            break
          }
          case 'ImportDefaultSpecifier': {
            importingName = 'default'
            break
          }
          case 'ImportNamespaceSpecifier': {
            // TODO handle
            throw new Error()
          }
        }

        if (!specifierMap.has(importingName)) {
          specifierMap.set(importingName, new Set())
        }
        specifierMap.get(importingName)!.add(spec.local.name)
      })
    }
  }

  // Every distinct source module being imported is given its own ImportDeclaration node
  const importDeclarations = Array.from(importsToSpecifiers.entries()).map(
    ([moduleName, imports]) => {
      // Across different modules, the user may choose to alias some of the declarations, so we keep track,
      // of all the different aliases used for each unique imported symbol
      const specifiers = Array.from(imports.entries()).flatMap(([importedName, aliases]) => {
        if (importedName === 'default') {
          return Array.from(aliases).map(alias =>
            createImportDefaultSpecifier(createIdentifier(alias))
          ) as (es.ImportSpecifier | es.ImportDefaultSpecifier)[]
        } else {
          return Array.from(aliases).map(alias =>
            createImportSpecifier(createIdentifier(alias), createIdentifier(importedName))
          )
        }
      })

      return createImportDeclaration(specifiers, createLiteral(moduleName))
    }
  )
  program.body = [...importDeclarations, ...program.body]
}
