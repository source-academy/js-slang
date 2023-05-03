import * as es from 'estree'

import { ReexportSymbolError } from '../errors/localImportErrors'
import {
  UndefinedDefaultImportError,
  UndefinedImportError,
  UndefinedNamespaceImportError
} from '../modules/errors'
import { extractIdsFromPattern } from '../utils/ast/astUtils'
import { isDeclaration } from '../utils/ast/typeGuards'

class ArrayMap<K, V> {
  constructor(private readonly map: Map<K, V[]> = new Map()) {}

  public get(key: K) {
    return this.map.get(key)
  }

  public add(key: K, item: V) {
    if (!this.map.has(key)) {
      this.map.set(key, [])
    }
    this.map.get(key)!.push(item)
  }

  public entries() {
    return Array.from(this.map.entries())
  }

  public keys() {
    return new Set(this.map.keys())
  }
}

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

export const validateImportAndExports = (
  moduleDocs: Record<string, Set<string> | null>,
  programs: Record<string, es.Program>,
  topoOrder: string[],
  allowUndefinedImports: boolean
) => {
  for (const name of topoOrder) {
    const program = programs[name]
    const exportedSymbols = new ArrayMap<
      string,
      es.ExportSpecifier | Exclude<es.ModuleDeclaration, es.ImportDeclaration>
    >()

    for (const node of program.body) {
      switch (node.type) {
        case 'ImportDeclaration': {
          const source = node.source!.value as string
          const exports = moduleDocs[source]
          if (!allowUndefinedImports && exports) {
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
          }
          break
        }
        case 'ExportDefaultDeclaration': {
          if (isDeclaration(node.declaration)) {
            if (node.declaration.type === 'VariableDeclaration') {
              throw new Error()
            }
            exportedSymbols.add('default', node)
          }
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
          break
        }
        case 'ExportAllDeclaration': {
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
          break
        }
      }
    }

    moduleDocs[name] = new Set(
      exportedSymbols.entries().map(([symbol, nodes]) => {
        if (nodes.length === 1) {
          return symbol
        }

        throw new ReexportSymbolError(name, symbol, nodes)
      })
    )
  }
}
