import type es from 'estree'
import { partition } from 'lodash'

import type { Context } from '../..'
import assert from '../../utils/assert'
import {
  getIdsFromDeclaration,
  getImportedName,
  getModuleDeclarationSource
} from '../../utils/ast/helpers'
import { isModuleDeclaration, isNamespaceSpecifier } from '../../utils/ast/typeGuards'
import Dict, { ArrayMap } from '../../utils/dict'
import { mapObject } from '../../utils/misc'
import {
  DuplicateImportNameError,
  UndefinedDefaultImportError,
  UndefinedImportError,
  UndefinedNamespaceImportError
} from '../errors'
import type { AbsolutePath } from '../moduleTypes'
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

/**
 * Import and Export analyzer:
 * - Checks for undefined imports
 * - Checks for different imports being given the same local name
 * Throws errors instead of appending errors to context
 */
export default function analyzeImportsAndExports(
  programs: Record<AbsolutePath, es.Program>,
  entrypointFilePath: AbsolutePath,
  topoOrder: string[],
  { nativeStorage: { loadedModules } }: Context,
  options: Partial<ImportAnalysisOptions> = {}
) {
  const moduleDocs = mapObject(loadedModules, each => new Set(Object.keys(each)))

  // Given the imports below
  // import { a as x } from 'module1'; import { b as x } from 'module1'; import { x } from 'module2';
  // import { b as y } from 'module1'; import { c as y } from 'module1'; import { y } from 'module2';
  // The declaredNames dict would (in effect) contain these entries:
  // {
  //    x: {
  //      module1: Set(['a', 'b']), // means a from module1 and b from module1 were both imported as x
  //      module2: Set(['x'])       // means x from module2 was imported as x
  //    },
  //    y: {
  //      module1: Set(['a', 'b']), // means b from module1 and c from module1 were both imported as y
  //      module2: Set(['y'])       // means y from module2 was imported as y
  //    }
  // }
  // The dict itself stores the specifiers instead of their names so that their locations can be
  // referred to
  const declaredNames = new Dict<
    string,
    ArrayMap<string, es.ImportDeclaration['specifiers'][number]>
  >()

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
      } else if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          if (!options.allowUndefinedImports) {
            const ids = getIdsFromDeclaration(node.declaration)
            ids.forEach(id => {
              assert(id !== null, 'Encountered a null identifier!')
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
      } else {
        for (const spec of node.specifiers) {
          if (spec.type !== 'ExportSpecifier' && isSourceModule(dstModule)) {
            const declaredName = spec.local.name
            declaredNames.setdefault(declaredName, new ArrayMap()).add(dstModule, spec)
          }

          if (!options.allowUndefinedImports) {
            if (isNamespaceSpecifier(spec)) {
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
        // This means that at least two different imports from two different modules
        // are using the same declared name, i.e case 1
        const nodes = moduleToSpecifierMap.flatMap((_, v) => v)
        throw new DuplicateImportNameError(localName, nodes)
      }

      // We can assume the there's only 1 entry, because if there were 0 entries
      // it would not have been included
      const [[, specifiers]] = moduleToSpecifierMap
      const [namespaceSpecifiers, regularSpecifiers] = partition<
        es.ImportDeclaration['specifiers'][number],
        es.ImportNamespaceSpecifier
      >(specifiers, isNamespaceSpecifier)

      // For the given local name, it can only represent one imported name from
      // the module. Collect all the names referring to the same export.
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
}
