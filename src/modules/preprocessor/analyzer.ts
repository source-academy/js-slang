import type * as es from 'estree'

import {
  ReexportSymbolError,
  UndefinedDefaultImportError,
  UndefinedImportError,
  UndefinedNamespaceImportError
} from '../../modules/errors'
import ArrayMap from '../../utils/arrayMap'
import assert from '../../utils/assert'
import { extractIdsFromPattern } from '../../utils/ast/astUtils'
import { simple } from '../../utils/ast/walkers'

const validateDefaultImport = (
  spec: es.ImportDefaultSpecifier | es.ExportSpecifier | es.ImportSpecifier,
  sourcePath: string,
  modExported: Set<string>
) => {
  if (!modExported.has('default')) {
    throw new UndefinedDefaultImportError(sourcePath, spec)
  }
}

const validateImport = (
  spec: es.ImportSpecifier | es.ExportSpecifier,
  sourcePath: string,
  modExported: Set<string>
) => {
  const symbol = spec.type === 'ImportSpecifier' ? spec.imported.name : spec.local.name
  if (symbol === 'default') {
    validateDefaultImport(spec, sourcePath, modExported)
  } else if (!modExported.has(symbol)) {
    throw new UndefinedImportError(symbol, sourcePath, spec)
  }
}

const validateNamespaceImport = (
  spec: es.ImportNamespaceSpecifier | es.ExportAllDeclaration,
  sourcePath: string,
  modExported: Set<string>
) => {
  if (modExported.size === 0) {
    throw new UndefinedNamespaceImportError(sourcePath, spec)
  }
}

/**
 * Check for undefined imports, and also for symbols that have multiple export
 * definitions
 */
export default function checkForUndefinedImportsAndReexports(
  moduleDocs: Record<string, Set<string>>,
  programs: Record<string, es.Program>,
  topoOrder: string[],
  allowUndefinedImports: boolean
) {
  for (const name of topoOrder) {
    const program = programs[name]
    const exportedSymbols = new ArrayMap<
      string,
      es.ExportSpecifier | Exclude<es.ModuleDeclaration, es.ImportDeclaration>
    >()

    simple(program, {
      ImportDeclaration: (node: es.ImportDeclaration) => {
        if (allowUndefinedImports) return
        const source = node.source!.value as string
        const exports = moduleDocs[source]

        node.specifiers.forEach(spec =>
          simple(spec, {
            ImportSpecifier: (spec: es.ImportSpecifier) => validateImport(spec, source, exports),
            ImportDefaultSpecifier: (spec: es.ImportDefaultSpecifier) =>
              validateDefaultImport(spec, source, exports),
            ImportNamespaceSpecifier: (spec: es.ImportNamespaceSpecifier) =>
              validateNamespaceImport(spec, source, exports)
          })
        )
      },
      ExportDefaultDeclaration: (node: es.ExportDefaultDeclaration) => {
        exportedSymbols.add('default', node)
      },
      ExportNamedDeclaration: (node: es.ExportNamedDeclaration) => {
        if (node.declaration) {
          if (node.declaration.type === 'VariableDeclaration') {
            for (const declaration of node.declaration.declarations) {
              extractIdsFromPattern(declaration.id).forEach(id => {
                exportedSymbols.add(id.name, node)
              })
            }
          } else {
            exportedSymbols.add(node.declaration.id!.name, node)
          }
        } else if (node.source) {
          const source = node.source!.value as string
          const exports = moduleDocs[source]
          node.specifiers.forEach(spec => {
            if (!allowUndefinedImports) {
              validateImport(spec, source, exports)
            }

            exportedSymbols.add(spec.exported.name, spec)
          })
        } else {
          node.specifiers.forEach(spec => exportedSymbols.add(spec.exported.name, spec))
        }
      },
      ExportAllDeclaration: (node: es.ExportAllDeclaration) => {
        const source = node.source!.value as string
        const exports = moduleDocs[source]
        if (!allowUndefinedImports) {
          validateNamespaceImport(node, source, exports)
        }
        if (node.exported) {
          exportedSymbols.add(node.exported.name, node)
        } else {
          exports.forEach(symbol => exportedSymbols.add(symbol, node))
        }
      }
    })

    moduleDocs[name] = new Set(
      exportedSymbols.entries().map(([symbol, nodes]) => {
        if (nodes.length === 1) return symbol
        assert(nodes.length > 0, 'An exported symbol cannot have zero nodes associated with it')
        throw new ReexportSymbolError(name, symbol, nodes)
      })
    )
  }
}
