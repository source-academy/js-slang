import es from 'estree'
import * as _ from 'lodash'

import { createImportDeclaration, createLiteral } from '../constructors/baseConstructors'
import { cloneAndStripImportSpecifier } from '../constructors/contextSpecificConstructors'
import { isImportDeclaration } from '../typeGuards'
import { isSourceModule } from './removeNonSourceModuleImports'

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
export const hoistAndMergeImports = (program: es.Program): void => {
  // Separate import declarations from non-import declarations.
  const importDeclarations = program.body.filter(isImportDeclaration)
  const nonImportDeclarations = program.body.filter(
    (node: es.Directive | es.Statement | es.ModuleDeclaration): boolean =>
      !isImportDeclaration(node)
  )

  // Merge import sources & specifiers.
  const importSourceToSpecifiersMap: Map<
    string,
    Array<es.ImportSpecifier | es.ImportDefaultSpecifier | es.ImportNamespaceSpecifier>
  > = new Map()
  for (const importDeclaration of importDeclarations) {
    const importSource = importDeclaration.source.value
    if (typeof importSource !== 'string') {
      throw new Error('Module names must be strings.')
    }
    const specifiers = importSourceToSpecifiersMap.get(importSource) ?? []
    for (const specifier of importDeclaration.specifiers) {
      // The Acorn parser adds extra information to AST nodes that are not
      // part of the ESTree types. As such, we need to clone and strip
      // the import specifier AST nodes to get a canonical representation
      // that we can use to keep track of whether the import specifier
      // is a duplicate or not.
      const strippedSpecifier = cloneAndStripImportSpecifier(specifier)
      // Note that we cannot make use of JavaScript's built-in Set class
      // as it compares references for objects.
      const isSpecifierDuplicate =
        specifiers.filter(
          (
            specifier: es.ImportSpecifier | es.ImportDefaultSpecifier | es.ImportNamespaceSpecifier
          ): boolean => {
            return _.isEqual(strippedSpecifier, specifier)
          }
        ).length !== 0
      if (isSpecifierDuplicate) {
        continue
      }
      specifiers.push(strippedSpecifier)
    }
    importSourceToSpecifiersMap.set(importSource, specifiers)
  }

  // Convert the merged import sources & specifiers back into import declarations.
  const mergedImportDeclarations: es.ImportDeclaration[] = []
  importSourceToSpecifiersMap.forEach(
    (
      specifiers: Array<
        es.ImportSpecifier | es.ImportDefaultSpecifier | es.ImportNamespaceSpecifier
      >,
      importSource: string
    ): void => {
      mergedImportDeclarations.push(
        createImportDeclaration(specifiers, createLiteral(importSource))
      )
    }
  )

  // Hoist the merged import declarations to the top of the program body.
  program.body = [...mergedImportDeclarations, ...nonImportDeclarations]
}

export default function hoistAndMergeImportsNew(programs: es.Program[]) {
  const allNodes = programs.flatMap(({ body }) => body)

  const importNodes = allNodes.filter(
    (node): node is es.ImportDeclaration => node.type === 'ImportDeclaration'
  )
  const importsToSpecifiers = new Map<string, Map<string, Set<string>>>()
  for (const node of importNodes) {
    const source = node.source!.value as string
    // We no longer need imports from non-source modules, so we can just ignore them
    if (!isSourceModule(source)) continue

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

  // Every distinct source module being imported is given its own ImportDeclaration node
  const importDeclarations = Array.from(importsToSpecifiers.entries()).map(
    ([moduleName, imports]) => {
      // Across different modules, the user may choose to alias some of the declarations, so we keep track,
      // of all the different aliases used for each unique imported symbol
      const specifiers = Array.from(imports.entries()).flatMap(([importedName, aliases]) => {
        if (importedName === 'default') {
          return Array.from(aliases).map(
            alias =>
              ({
                type: 'ImportDefaultSpecifier',
                local: {
                  type: 'Identifier',
                  name: alias
                }
              } as es.ImportDefaultSpecifier)
          ) as (es.ImportSpecifier | es.ImportDefaultSpecifier)[]
        } else {
          return Array.from(aliases).map(
            alias =>
              ({
                type: 'ImportSpecifier',
                imported: {
                  type: 'Identifier',
                  name: importedName
                },
                local: {
                  type: 'Identifier',
                  name: alias
                }
              } as es.ImportSpecifier)
          )
        }
      })

      const decl: es.ImportDeclaration = {
        type: 'ImportDeclaration',
        source: {
          type: 'Literal',
          value: moduleName
        },
        specifiers
      }
      return decl
    }
  )
  return importDeclarations
}
