import type es from 'estree'
import { partition } from 'lodash'

import assert from '../../utils/assert'
import {
  getDeclaredIdentifiers,
  getImportedName,
  getModuleDeclarationSource
} from '../../utils/ast/helpers'
import { isModuleDeclaration, isNamespaceSpecifier } from '../../utils/ast/typeGuards'
import Dict, { ArrayMap } from '../../utils/dict'
import {
  DuplicateImportNameError,
  UndefinedDefaultImportError,
  UndefinedImportError,
  UndefinedNamespaceImportError
} from '../errors'
import { isSourceModule } from '../utils'
import type { Context } from '../../types'

export const defaultAnalysisOptions: ImportAnalysisOptions = {
  allowUndefinedImports: false,
  throwOnDuplicateNames: true
}

/**
 * Options to configure import analysis
 */
export type ImportAnalysisOptions = {
  /**
   * Set to true to allow trying to import symbols that aren't exported by
   * the module being imported
   */
  allowUndefinedImports: boolean

  /**
   * Set to true to throw errors when different imported symbols are given
   * the same declared name
   */
  throwOnDuplicateNames: boolean
}

/**
 * Import and Export analyzer:
 * - Checks for undefined imports
 * - Checks for different imports being given the same local name
 */
export default function analyzeImportsAndExports(
  programs: Record<string, es.Program>,
  entrypointFilePath: string,
  topoOrder: string[],
  { nativeStorage: { loadedModules } }: Context,
  options: Partial<ImportAnalysisOptions> = {}
) {
  const declaredNames = new Dict<
    string,
    ArrayMap<string, es.ImportDeclaration['specifiers'][number]>
  >()

  const moduleDocs: Record<string, Set<string>> = Object.fromEntries(
    Object.entries(loadedModules).map(([name, obj]) => [name, new Set(Object.keys(obj))])
  )

  topoOrder = topoOrder.filter(p => p !== entrypointFilePath)

  for (const sourceModule of [...topoOrder, entrypointFilePath]) {
    const program = programs[sourceModule]
    moduleDocs[sourceModule] = new Set()

    for (const node of program.body) {
      if (node.type === 'ExportDefaultDeclaration') {
        if (!options.allowUndefinedImports) {
          assert(
            !moduleDocs[sourceModule].has('default'),
            "Multiple default exports should've been caught by the parser"
          )
          moduleDocs[sourceModule].add('default')
        }
        continue
      }

      if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          if (!options.allowUndefinedImports) {
            const ids = getDeclaredIdentifiers(node.declaration)
            ids.forEach(id => {
              moduleDocs[sourceModule].add(id.name)
            })
          }
          continue
        }

        for (const spec of node.specifiers) {
          moduleDocs[sourceModule].add(spec.exported.name)
        }

        if (!node.source) continue
      } else if (!isModuleDeclaration(node)) {
        continue
      }

      const dstModule = getModuleDeclarationSource(node)
      const dstModuleDocs = moduleDocs[dstModule]

      if (node.type === 'ExportAllDeclaration') {
        if (!options.allowUndefinedImports) {
          if (dstModuleDocs.size === 0) throw new UndefinedNamespaceImportError(dstModule, node)

          if (node.exported) {
            moduleDocs[sourceModule].add(node.exported.name)
          } else {
            for (const each of dstModuleDocs) {
              if (each === 'default') {
                // ExportAllDeclarations do not implicitly reexport default exports
                continue
              }

              moduleDocs[sourceModule].add(each)
            }
          }
        }
        continue
      }

      for (const spec of node.specifiers) {
        if (
          options.throwOnDuplicateNames &&
          spec.type !== 'ExportSpecifier' &&
          isSourceModule(dstModule)
        ) {
          const declaredName = spec.local.name
          declaredNames.setdefault(declaredName, new ArrayMap()).add(dstModule, spec)
        }

        if (options.allowUndefinedImports) continue

        if (spec.type === 'ImportNamespaceSpecifier') {
          if (dstModuleDocs.size === 0) throw new UndefinedNamespaceImportError(dstModule, spec)
          continue
        }

        const importedName = getImportedName(spec)

        if (!dstModuleDocs.has(importedName)) {
          if (importedName === 'default') throw new UndefinedDefaultImportError(dstModule, spec)
          throw new UndefinedImportError(importedName, dstModule, spec)
        }
      }
    }
  }

  if (!options.throwOnDuplicateNames) return

  // Because of the way the preprocessor works, different imports with the same declared name
  // will cause errors
  // There are two conditions we need to check:
  // 1. Two different symbols from the same module are declared with the same name:
  // import { a as x } from 'one_module'; AND import { b as x } from 'one_module';
  // 2. Two different symbols from different modules are declared with the same name:
  // import { a } from 'one_module'; AND import { b as a } from 'another_module';
  for (const [localName, moduleToSpecifierMap] of declaredNames) {
    if (moduleToSpecifierMap.size > 1) {
      // This means that two imports from different modules have the same
      // declared name
      const nodes = moduleToSpecifierMap.flatMap((_, v) => v)
      throw new DuplicateImportNameError(localName, nodes)
    }

    const [[, specifiers]] = moduleToSpecifierMap
    const [namespaceSpecifiers, regularSpecifiers] = partition<
      es.ImportDeclaration['specifiers'][number],
      es.ImportNamespaceSpecifier
    >(specifiers, isNamespaceSpecifier)

    // For the given local name, it can only represent one imported name from
    // the module. Collect specifiers referring to the same export.
    const importedNames = new Set(regularSpecifiers.map(getImportedName))

    if (
      (namespaceSpecifiers.length > 0 && regularSpecifiers.length > 0) ||
      importedNames.size > 1
    ) {
      // This means that there is more than one unique export being given the same
      // local name
      const specs = [...regularSpecifiers, ...namespaceSpecifiers]
      throw new DuplicateImportNameError(localName, specs)
    }
  }
}
