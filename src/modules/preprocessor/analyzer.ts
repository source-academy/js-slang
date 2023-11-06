import type * as es from 'estree'
import { partition } from 'lodash'

import assert from '../../utils/assert'
import { extractIdsFromPattern, getImportedName } from '../../utils/ast/helpers'
import { isModuleDeclaration, isVariableDeclaration } from '../../utils/ast/typeGuards'
import Dict, { ArrayMap } from '../../utils/dict'
import {
  DuplicateImportNameError,
  UndefinedDefaultImportError,
  UndefinedImportError,
  UndefinedNamespaceImportError
} from '../errors'
import { memoizedGetModuleDocsAsync } from '../loader/moduleLoaderAsync'
import { isSourceModule } from '../utils'

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

function isNamespaceSpecifier(
  node: es.ImportDeclaration['specifiers'][0]
): node is es.ImportNamespaceSpecifier {
  return node.type === 'ImportNamespaceSpecifier'
}

/**
 * Import and Export analyzer:
 * - Checks for undefined imports
 * - Checks for different imports being given the same local name
 */
export default async function analyzeImportsAndExports(
  programs: Record<string, es.Program>,
  topoOrder: string[],
  sourceModulesToImport: Set<string>,
  options: Partial<ImportAnalysisOptions> = {}
) {
  const moduleDocs: Record<string, Set<string>> = options.allowUndefinedImports
    ? {}
    : Object.fromEntries(
        await Promise.all(
          [...sourceModulesToImport].map(async moduleName => {
            const docs = await memoizedGetModuleDocsAsync(moduleName)
            if (docs === null) {
              throw new Error(`Failed to load documentation for ${moduleName}`)
            }
            return [moduleName, new Set(Object.keys(docs))]
          })
        )
      )
  const declaredNames = new Dict<
    string,
    ArrayMap<string, es.ImportDeclaration['specifiers'][number]>
  >()

  for (const sourceModule of topoOrder) {
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
      } else if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          if (!options.allowUndefinedImports) {
            const ids = isVariableDeclaration(node.declaration)
              ? node.declaration.declarations.flatMap(({ id }) => extractIdsFromPattern(id))
              : [node.declaration.id!]

            ids.forEach(({ name }) => moduleDocs[sourceModule].add(name))
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

      const dstModule = node.source?.value
      assert(typeof dstModule === 'string', 'Node source value should not be null here')

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
      } else {
        for (const spec of node.specifiers) {
          if (spec.type !== 'ExportSpecifier' && isSourceModule(dstModule)) {
            const declaredName = spec.local.name
            declaredNames.setdefault(declaredName, new ArrayMap()).add(dstModule, spec)
          }

          if (!options.allowUndefinedImports) {
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
    }
  }

  if (options.throwOnDuplicateNames) {
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
      const [namespaceSpecifiers, regularSpecifiers] = partition(specifiers, isNamespaceSpecifier)
      const importedNames = new Set<string>()

      // For the given local name, it can only represent one imported name from
      // the module. Collect specifiers referring to the same export.
      regularSpecifiers.forEach(spec => {
        const importedName = getImportedName(spec)
        importedNames.add(importedName)
      })

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
}
