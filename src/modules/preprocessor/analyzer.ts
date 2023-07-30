import { UNKNOWN_LOCATION } from '../../constants'
import {
  ModuleInternalError,
  ReexportDefaultError,
  ReexportSymbolError,
  UndefinedDefaultImportError,
  UndefinedImportError,
  UndefinedNamespaceImportError
} from '../../modules/errors'
import { reduceAsync } from '../../utils/misc'
import ArrayMap from '../../utils/arrayMap'
import assert from '../../utils/assert'
import * as create from '../../utils/ast/astCreator'
import { extractIdsFromPattern, processExportNamedDeclaration } from '../../utils/ast/astUtils'
import { isSourceImport } from '../../utils/ast/typeGuards'
import type * as es from '../../utils/ast/types'
import { memoizedGetModuleDocsAsync } from '../moduleLoaderAsync'

type ExportRecord = {
  /**
   * The name of the symbol defined by its source
   */
  symbolName: string

  /**
   * The actual source in which the symbol is defined
   */
  source: string

  loc: es.SourceLocation
}

/**
 * An abstraction of the `Set<string>` type. When `allowUndefinedImports` is true,
 * the set is replaced with an object that will never throw an error for any kind
 * of imported symbol
 */
type ExportSymbolsRecord = {
  has: (symbol: string) => boolean
  readonly size: number
  [Symbol.iterator]: () => Iterator<string>
}

/**
 * An abstraction of the `Map<string, ExportRecord>` type. When `allowUndefinedImports` is true,
 * the set is replaced with an object that will ensure no errors are thrown for any kind
 * of imported symbol
 */
type ExportSourceMap = {
  get: (symbol: string) => ExportRecord | undefined
  set: (symbol: string, value: ExportRecord) => void
  keys: () => Iterable<string>
}

const validateDefaultImport = (
  spec: es.ImportDefaultSpecifier | es.ExportSpecifier | es.ImportSpecifier,
  sourcePath: string,
  modExported: ExportSymbolsRecord
) => {
  if (!modExported.has('default')) {
    throw new UndefinedDefaultImportError(sourcePath, spec)
  }
}

const validateImport = (
  spec: es.ImportSpecifier | es.ImportDefaultSpecifier | es.ExportSpecifier,
  sourcePath: string,
  modExported: ExportSymbolsRecord
) => {
  let symbol: string
  switch (spec.type) {
    case 'ExportSpecifier': {
      symbol = spec.local.name
      break
    }
    case 'ImportSpecifier': {
      symbol = spec.imported.name
      break
    }
    case 'ImportDefaultSpecifier': {
      symbol = 'default'
      break
    }
  }

  if (symbol === 'default') {
    validateDefaultImport(spec, sourcePath, modExported)
  } else if (!modExported.has(symbol)) {
    throw new UndefinedImportError(symbol, sourcePath, spec)
  }
}

const validateNamespaceImport = (
  spec: es.ImportNamespaceSpecifier | es.ExportAllDeclaration,
  sourcePath: string,
  modExported: ExportSymbolsRecord
) => {
  if (modExported.size === 0) {
    throw new UndefinedNamespaceImportError(sourcePath, spec)
  }
}

/**
 * Check for undefined imports, and also for symbols that have multiple export
 * definitions, and also resolve export and import directives to their sources
 */
export default async function analyzeImportsAndExports(
  programs: Record<string, es.Program>,
  topoOrder: string[],
  allowUndefinedImports: boolean
) {
  const exportMap: Record<string, ExportSourceMap> = {}

  /**
    The idea behind this function is to resolve indirect exports
    For example
    ```
    // a.js
    export const a = "a";
    // b.js
    export { a as b } from './a.js'
    ```

    We want to change the following import statement `import { b } from './b.js'` to
    `import { a } from './a.js', since the `export` declaration in `b.js` just serves
    as a redirection and doesn't affect code behaviour
   */
  function resolveSymbol(source: string, desiredSymbol: string): [string, string] {
    let symbolName: string
    let newSource: string
    let loc: es.SourceLocation

      // So for each exported symbol, we return the path to the file where it is actually
      // defined and the name it was defined with (since exports can have aliases)
      // Kind of like a UFDS, where the roots of each set are symbols that are defined within
      // its own file, or imports from Source modules

      // eslint-disable-next-line prefer-const
    ;({ source: newSource, symbolName, loc } = exportMap[source].get(desiredSymbol)!)
    if (isSourceImport(source) || newSource === source) return [newSource, symbolName]
    ;[newSource, symbolName] = resolveSymbol(newSource, symbolName)
    exportMap[source].set(desiredSymbol, { source: newSource, symbolName, loc })
    return [newSource, symbolName]
  }

  const getDocs = async (
    node: es.ModuleDeclarationWithSource
  ): Promise<[ExportSymbolsRecord, string]> => {
    const path = node.source!.value as string

    if (allowUndefinedImports) {
      exportMap[path] = {
        get: (symbol: string) => ({
          source: path,
          symbolName: symbol,
          loc: UNKNOWN_LOCATION
        }),
        set: () => {},
        keys: () => ['']
      }

      // When undefined imports are allowed, we substitute the list of exported
      // symbols for an object that behaves like a set but always returns true when
      // `has` is queried
      return [
        {
          has: () => true,
          [Symbol.iterator]: () => ({ next: () => ({ done: true, value: null }) }),
          size: 9999
        },
        path
      ]
    }

    if (!(path in exportMap)) {
      // Because modules are loaded in topological order, the exported symbols for a local
      // module should be loaded by the time they are needed
      // So we can assume that it is the documentation for a Source module that needs to be
      // loaded here
      assert(
        isSourceImport(path),
        `Trying to load: ${path}, local modules should already have been loaded in topological order`
      )

      const docs = await memoizedGetModuleDocsAsync(path)
      if (!docs) {
        throw new ModuleInternalError(path, `Failed to load documentation for ${path}`)
      }
      exportMap[path] = new Map(
        Object.keys(docs).map(symbol => [
          symbol,
          { source: path, symbolName: symbol, loc: UNKNOWN_LOCATION }
        ])
      )
    }
    return [new Set(exportMap[path].keys()), path]
  }

  const newImportDeclaration = (
    source: string,
    local: es.Identifier,
    imported: string
  ): es.ImportDeclaration => ({
    type: 'ImportDeclaration',
    source: create.literal(source),
    specifiers: [
      imported === 'default'
        ? {
            type: 'ImportDefaultSpecifier',
            local
          }
        : {
            type: 'ImportSpecifier',
            local,
            imported: create.identifier(imported)
          }
    ]
  })

  const newPrograms: Record<string, es.Program> = {}
  for (const moduleName of topoOrder) {
    const program = programs[moduleName]
    const exportedSymbols = new ArrayMap<string, ExportRecord>()

    const newBody = await reduceAsync(
      program.body,
      async (body, node) => {
        switch (node.type) {
          case 'ImportDeclaration': {
            const [exports, source] = await getDocs(node)
            const newDecls = node.specifiers.map(spec => {
              switch (spec.type) {
                case 'ImportDefaultSpecifier':
                case 'ImportSpecifier': {
                  if (!allowUndefinedImports) validateImport(spec, source, exports)

                  const desiredSymbol =
                    spec.type === 'ImportSpecifier' ? spec.imported.name : 'default'
                  const [newSource, symbolName] = resolveSymbol(source, desiredSymbol)
                  return newImportDeclaration(newSource, spec.local, symbolName)
                }
                case 'ImportNamespaceSpecifier': {
                  throw new Error('Namespace imports are not supported!')
                  // validateNamespaceImport(spec, source, exports)
                  // return {
                  //   ...node,
                  //   specifiers: [spec]
                  // }
                }
              }
            })
            return [...body, ...newDecls]
          }
          case 'ExportDefaultDeclaration': {
            exportedSymbols.add('default', {
              source: moduleName,
              symbolName: 'default',
              loc: node.loc!
            })
            return [...body, node]
          }
          case 'ExportNamedDeclaration': {
            return await processExportNamedDeclaration(node, {
              withVarDecl: async ({ declarations }) => {
                for (const { id } of declarations) {
                  extractIdsFromPattern(id).forEach(({ name }) => {
                    exportedSymbols.add(name, {
                      source: moduleName,
                      symbolName: name,
                      loc: id.loc!
                    })
                  })
                }
                return [...body, node]
              },
              withFunction: async ({ id: { name } }) => {
                exportedSymbols.add(name, {
                  source: moduleName,
                  symbolName: name,
                  loc: node.loc!
                })
                return [...body, node]
              },
              withClass: async ({ id: { name } }) => {
                exportedSymbols.add(name, {
                  source: moduleName,
                  symbolName: name,
                  loc: node.loc!
                })
                return [...body, node]
              },
              localExports: async ({ specifiers }) => {
                specifiers.forEach(spec =>
                  exportedSymbols.add(spec.exported.name, {
                    source: moduleName,
                    symbolName: spec.local.name,
                    loc: spec.loc!
                  })
                )
                return [...body, node]
              },
              withSource: async node => {
                const [exports, source] = await getDocs(node)
                const newDecls = node.specifiers.map(spec => {
                  if (!allowUndefinedImports) validateImport(spec, source, exports)

                  const [newSource, symbolName] = resolveSymbol(source, spec.local.name)
                  exportedSymbols.add(spec.exported.name, {
                    source: newSource,
                    symbolName,
                    loc: spec.loc!
                  })

                  const newDecl: es.ExportNamedDeclarationWithSource = {
                    type: 'ExportNamedDeclaration',
                    declaration: null,
                    source: create.literal(newSource),
                    specifiers: [
                      {
                        type: 'ExportSpecifier',
                        exported: spec.exported,
                        local: create.identifier(symbolName)
                      }
                    ]
                  }
                  return newDecl
                })
                return [...body, ...newDecls]
              }
            })
          }
          case 'ExportAllDeclaration': {
            if (node.exported) {
              throw new Error('ExportAllDeclarations with exported name are not supported')
              // exportedSymbols.add(node.exported.name, {
              //   source,
              //   symbolName: node.exported.name,
              //   loc: node.loc!,
              // })
            } else {
              const [exports, source] = await getDocs(node)
              if (!allowUndefinedImports) validateNamespaceImport(node, source, exports)

              for (const symbol of exports) {
                const [newSource, newSymbol] = resolveSymbol(source, symbol)
                exportedSymbols.add(symbol, {
                  source: newSource,
                  symbolName: newSymbol,
                  loc: node.loc!
                })
              }
            }
          }
          default:
            return [...body, node]
        }
      },
      [] as es.Program['body']
    )

    exportMap[moduleName] = new Map(
      exportedSymbols.entries().map(([symbol, records]) => {
        if (records.length === 1) return [symbol, records[0]]
        assert(records.length > 0, 'An exported symbol cannot have zero nodes associated with it')
        const locations = records.map(({ loc }) => loc)
        if (symbol === 'default') {
          throw new ReexportDefaultError(moduleName, locations)
        } else {
          throw new ReexportSymbolError(moduleName, symbol, locations)
        }
      })
    )

    newPrograms[moduleName] = {
      ...program,
      body: newBody
    }
  }

  return newPrograms
}
