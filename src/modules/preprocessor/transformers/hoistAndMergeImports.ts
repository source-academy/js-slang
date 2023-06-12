import { extractIdsFromPattern } from '../../../utils/ast/astUtils'
import { isImportDeclaration, isSourceImport } from '../../../utils/ast/typeGuards'
import type * as es from '../../../utils/ast/types'
import {
  createIdentifier,
  createImportDeclaration,
  createImportDefaultSpecifier,
  createImportNamespaceSpecifier,
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
export default function hoistAndMergeImports(program: es.Program, programs: Record<string, es.Program>, topoOrder: string[]) {
  // There are two kinds of declarations we need to deal with
  // 1. ImportDeclarations that import from source modules
  // 2. ExportNamedDeclarations that import from source modules 

  const exportMap = topoOrder.reduce((res, moduleName) => {
    const program = programs[moduleName]
    const exportedSymbols = new Map<string, string>()

    program.body.forEach(node => {
      switch (node.type) {
        case 'ExportDefaultDeclaration': {
          exportedSymbols.set('default', moduleName)
          break
        }
        case 'ExportNamedDeclaration': {
          if (node.declaration) {
            if (node.declaration.type === 'VariableDeclaration') {
              node.declaration.declarations.forEach(({ id }) => {
                extractIdsFromPattern(id).forEach(({ name }) => exportedSymbols.set(name, moduleName))
              })
              break
            }

            exportedSymbols.set(node.declaration.id!.name, moduleName)
          } else if (!node.source) {
            node.specifiers.forEach(({ exported: { name }}) => exportedSymbols.set(name, moduleName))
          } else {
            const source = node.source.value as string
            node.specifiers.forEach(({ exported: { name }}) => exportedSymbols.set(name, source))
          }
          break
        }
      }
    })

    return {
      ...res,
      [moduleName]: exportedSymbols
    }
  }, {} as Record<string, Map<string, string>>)

  // @ts-ignore
  function resolveLocalImport(desiredSymbol: string, source: string) {
    const exportedSymbols = exportMap[source]
    if (exportedSymbols.has(desiredSymbol)) {
      // The desired symbol is found inside this 
    }

  }

  const importsToSpecifiers = new Map<
    string,
    { namespaceSymbols: Set<string>; imports: Map<string, Set<string>> }
  >()
  
  // Now we go over the programs again
  topoOrder.forEach(moduleName => {
    const program = programs[moduleName]
    program.body.forEach(node => {
      if (!isImportDeclaration(node)) return

      const source = node.source!.value as string
      // We no longer need imports from non-source modules, so we can just ignore them
      if (!isSourceImport(source)) return

      if (!importsToSpecifiers.has(source)) {
        importsToSpecifiers.set(source, {
          namespaceSymbols: new Set(),
          imports: new Map()
        })
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
            specifierMap.namespaceSymbols.add(spec.local.name)
            return
          }
        }

        if (!specifierMap.imports.has(importingName)) {
          specifierMap.imports.set(importingName, new Set())
        }
        specifierMap.imports.get(importingName)!.add(spec.local.name)
      })
    })
  })

  // Every distinct source module being imported is given its own ImportDeclaration node
  const importDeclarations = Array.from(importsToSpecifiers.entries()).flatMap(
    ([moduleName, { imports, namespaceSymbols }]) => {
      // Across different modules, the user may choose to alias some of the declarations, so we keep track,
      // of all the different aliases used for each unique imported symbol
      const specifiers = Array.from(imports.entries()).flatMap(([importedName, aliases]) => {
        if (importedName !== 'default') {
          return Array.from(aliases).map(alias =>
            createImportSpecifier(createIdentifier(alias), createIdentifier(importedName))
          )
        } else {
          return []
        }
      })

      let output =
        specifiers.length > 0
          ? [createImportDeclaration(specifiers, createLiteral(moduleName))]
          : []
      if (imports.has('default')) {
        // You can't have multiple default specifiers per node, so we need to create
        // a new node for each
        output = output.concat(
          Array.from(imports.get('default')!.values()).map(alias =>
            createImportDeclaration(
              [createImportDefaultSpecifier(createIdentifier(alias))],
              createLiteral(moduleName)
            )
          )
        )
      }

      if (namespaceSymbols.size > 0) {
        // You can't have multiple namespace specifiers per node, so we need to create
        // a new node for each
        output = output.concat(
          Array.from(namespaceSymbols).map(alias =>
            createImportDeclaration(
              [createImportNamespaceSpecifier(createIdentifier(alias))],
              createLiteral(moduleName)
            )
          )
        )
      }

      return output
    }
  )
  program.body = [...importDeclarations, ...program.body]
}
