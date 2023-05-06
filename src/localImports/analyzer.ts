import type * as es from 'estree'

import { ReexportSymbolError } from '../errors/localImportErrors'
import {
  UndefinedDefaultImportError,
  UndefinedImportError,
  UndefinedNamespaceImportError
} from '../modules/errors'
import ArrayMap from '../utils/arrayMap'
import { extractIdsFromPattern } from '../utils/ast/astUtils'
import { isDeclaration } from '../utils/ast/typeGuards'
import { simple } from '../utils/ast/walkers'

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
export const validateImportAndExports = (
  moduleDocs: Record<string, Set<string> | null>,
  programs: Record<string, es.Program>,
  topoOrder: string[],
  allowUndefinedImports: boolean
) => {
  for (const name of topoOrder) {
    // Since we're loading in topological order, it is safe to assume that
    // program will never be undefined
    const program = programs[name]
    const exportedSymbols = new ArrayMap<
      string,
      es.ExportSpecifier | Exclude<es.ModuleDeclaration, es.ImportDeclaration>
    >()

    simple(program, {
      ImportDeclaration: (node: es.ImportDeclaration) => {
        const source = node.source!.value as string
        const exports = moduleDocs[source]
        if (allowUndefinedImports || !exports) return

        node.specifiers.forEach(spec => {
          simple(spec, {
            ImportSpecifier: (spec: es.ImportSpecifier) => validateImport(spec, source, exports),
            ImportDefaultSpecifier: (spec: es.ImportDefaultSpecifier) =>
              validateDefaultImport(spec, source, exports),
            ImportNamespaceSpecifier: (spec: es.ImportNamespaceSpecifier) =>
              validateNamespaceImport(spec, source, exports)
          })
        })
      },
      ExportDefaultDeclaration: (node: es.ExportDefaultDeclaration) => {
        if (isDeclaration(node.declaration)) {
          exportedSymbols.add('default', node)
        }
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
            if (!allowUndefinedImports && exports) {
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
        if (!allowUndefinedImports && exports) {
          validateNamespaceImport(node, source, exports)
        }
        if (node.exported) {
          exportedSymbols.add(node.exported.name, node)
        } else if (exports) {
          for (const symbol of exports) {
            exportedSymbols.add(symbol, node)
          }
        }
      }
    })

    moduleDocs[name] = new Set(
      exportedSymbols.entries().map(([symbol, nodes]) => {
        if (nodes.length === 1) return symbol
        throw new ReexportSymbolError(name, symbol, nodes)
      })
    )
  }
}
