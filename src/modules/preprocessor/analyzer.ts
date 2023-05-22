import {
  ModuleInternalError,
  ReexportDefaultError,
  ReexportSymbolError,
  UndefinedDefaultImportError,
  UndefinedImportError,
  UndefinedNamespaceImportError
} from '../../modules/errors'
import ArrayMap from '../../utils/arrayMap'
import assert from '../../utils/assert'
import { extractIdsFromPattern } from '../../utils/ast/astUtils'
import { isSourceImport } from '../../utils/ast/typeGuards'
import type * as es from '../../utils/ast/types'
import { memoizedGetModuleDocsAsync } from '../moduleLoaderAsync'

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
export default async function checkForUndefinedImportsAndReexports(
  programs: Record<string, es.Program>,
  topoOrder: string[],
  allowUndefinedImports: boolean
) {
  const moduleDocs: Record<string, Set<string>> = {}

  const getDocs = async (node: es.SourcedModuleDeclaration): Promise<[Set<string>, string]> => {
    const path = node.source!.value as string
    if (path in moduleDocs) return [moduleDocs[path], path]

    // Because modules are loaded in topological order, the exported symbols for a local
    // module should be loaded by the time they are needed
    // So we can assume that it is the documentation for Source modules that needs to be
    // loaded here
    assert(isSourceImport(path), 'Local modules should\'ve been loaded in topological order')
    
    const docs = await memoizedGetModuleDocsAsync(path)
    if (!docs) {
      throw new ModuleInternalError(path, `Failed to load documentation for ${path}`)
    }

    return [new Set(Object.keys(docs)), path]
  }

  for (const name of topoOrder) {
    const program = programs[name]
    const exportedSymbols = new ArrayMap<string, es.ExportSpecifier | es.ExportDeclaration>()
    for (const node of program.body) {
      switch (node.type) {
        case 'ImportDeclaration': {
          if (allowUndefinedImports) continue
          const [exports, source] = await getDocs(node)

          node.specifiers.forEach(spec => {
            switch (spec.type) {
              case 'ImportSpecifier': {
                validateImport(spec, source, exports)
                break
              }
              case 'ImportDefaultSpecifier': {
                validateDefaultImport(spec, source, exports)
                break
              }
              case 'ImportNamespaceSpecifier': {
                validateNamespaceImport(spec, source, exports)
                break
              }
            }
          })
          break
        }
        case 'ExportAllDeclaration': {
          const [exports, source] = await getDocs(node)
          if (!allowUndefinedImports) {
            validateNamespaceImport(node, source, exports)
          }
          if (node.exported) {
            exportedSymbols.add(node.exported.name, node)
          } else {
            exports.forEach(symbol => exportedSymbols.add(symbol, node))
          }
          break
        }
        case 'ExportDefaultDeclaration': {
          exportedSymbols.add('default', node)
          break
        }
        case 'ExportNamedDeclaration': {
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
            const [exports, source] = await getDocs(node)
            node.specifiers.forEach(spec => {
              if (!allowUndefinedImports) {
                validateImport(spec, source, exports)
              }

              exportedSymbols.add(spec.exported.name, spec)
            })
          } else {
            node.specifiers.forEach(spec => exportedSymbols.add(spec.exported.name, spec))
          }
          break
        }
      }
    }

    moduleDocs[name] = new Set(
      exportedSymbols.entries().map(([symbol, nodes]) => {
        if (nodes.length === 1) return symbol
        assert(nodes.length > 0, 'An exported symbol cannot have zero nodes associated with it')
        if (symbol === 'default') {
          throw new ReexportDefaultError(name, nodes)
        } else {
          throw new ReexportSymbolError(name, symbol, nodes)
        }
      })
    )
  }
}
